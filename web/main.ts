import { mountGridOverlay } from './grid-overlay.js';
import { emptyHeaderText } from './header-panel.js';
import { mastersAgree, type FontMaster } from './import/font-source.js';
import { applyFontMetrics, readUpload } from './import/read-upload.js';
import { defaultLineStyles } from './line-styles.js';
import { ConfigError } from '../src/index.js';
import type { LabelText } from '../src/render/ops.js';
import { createLineCard } from './line-card.js';
import { createPageCard } from './page-card.js';
import { createRowCard } from './row-card.js';
import { copyRowState, newRowState, rowInput, rowValues } from './row-input.js';
import { MAX_ROWS, createChoiceToggle, createRowCountTabs } from './sheet-controls.js';
import { drawSheetFitted } from './sheet-canvas.js';
import type { RowMetrics, SheetState } from './sheet-file.js';
import { defaultPageSetup, previewSheet, type PreviewSheet } from './sheet-preview.js';
import { createUploadDialog } from './upload-dialog.js';
import type { UploadFile } from './upload.js';

/**
 * The sheet as the page holds it. With "same", every row draws row 1's
 * state. Rows past the count keep their state for when the count comes
 * back up.
 *
 * Loading a config replaces it, and the page is built again from it.
 */
let sheet: SheetState = {
  // The page starts small; the engine's own default (5) is for sheets made
  // without it.
  rowCount: 3,
  metrics: 'same',
  rows: Array.from({ length: MAX_ROWS }, newRowState),
  /** How each line is drawn, the same in every row. */
  lines: defaultLineStyles(),
  /** Optional text across the top of the page. */
  header: emptyHeaderText(),
  /** The paper: its size and orientation. */
  page: defaultPageSetup(),
};

/** The sheet as it will print, or why it can't be made. */
function sheetContent(): PreviewSheet | { message: string } {
  const inputs = [];
  const values: LabelText[] = [];
  for (let i = 0; i < sheet.rowCount; i++) {
    const state = sheet.metrics === 'same' ? sheet.rows[0]! : sheet.rows[i]!;
    values.push(rowValues(state));
    const input = rowInput(state, sheet.lines);
    if (!input) {
      // With shared metrics, row 1's values are the ones to fix.
      const row = sheet.metrics === 'same' ? 1 : i + 1;
      return { message: `Row ${row} has a value to fix before the sheet can be drawn.` };
    }
    inputs.push(input);
  }
  try {
    return previewSheet(inputs, sheet.header, sheet.page, values);
  } catch (error) {
    // The one page-wide value that can leave no room: the margin.
    if (!(error instanceof ConfigError)) throw error;
    return { message: 'The margin leaves no room for the rows. Try a smaller one.' };
  }
}

/**
 * An uploaded file, whatever it is. A config replaces the sheet. A font's
 * metrics go into row 1 — and so every row, when they share it — after
 * asking which master, if its masters differ. Done, the dialog closes; going
 * back from the masters leaves it open on the drop area.
 */
async function load(file: UploadFile): Promise<void> {
  const upload = readUpload(file.name, file.bytes);
  if (upload.kind === 'sheet') {
    sheet = upload.sheet;
    render();
    uploadDialog.close();
    return;
  }
  const { masters } = upload.source;
  const master: FontMaster | null = mastersAgree(masters)
    ? masters[0]!
    : await uploadDialog.chooseMaster(file.name, masters);
  if (!master) return;
  applyFontMetrics(sheet.rows[0]!, master.metrics);
  redraw();
  uploadDialog.close();
}

const uploadDialog = createUploadDialog(load);

let root: HTMLElement | null = null;

/**
 * Where the sheet is drawn: the paper — a frame holding the canvas — or a
 * message in its place, with a bar of controls over it, as wide as it. The
 * frame carries the paper's size, shadow and white, so it can change shape
 * smoothly while the canvas is redrawn.
 */
const stage = document.createElement('div');
stage.className = 'workspace-preview';
const sheetBox = document.createElement('div');
sheetBox.className = 'workspace-sheet';
/** Over the paper: filled by render(). */
const sheetBar = document.createElement('div');
sheetBar.className = 'workspace-sheet-bar';
sheetBox.append(sheetBar);
stage.append(sheetBox);
const frame = document.createElement('div');
frame.className = 'workspace-paper';
const paper = document.createElement('canvas');
frame.append(paper);
const message = document.createElement('p');
message.className = 'body-md workspace-preview-message';
/** Left of the paper, outside it: an Edit button level with each row. */
const rowEdits = document.createElement('div');
rowEdits.className = 'workspace-row-edits';

const SVG = 'http://www.w3.org/2000/svg';

/** An icon of one path, drawn in the button's colour. */
function icon(name: string, d: string): SVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add(`icon-${name}`);
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}

/**
 * A button floating over the mat: an icon and its words, or an X and Close
 * while what it opens is open.
 */
function floatButton(d: string, words: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'float-button';
  const label = document.createElement('span');
  label.className = 'float-button-label';
  const editLabel = document.createElement('span');
  editLabel.className = 'label-edit';
  editLabel.textContent = words;
  const closeLabel = document.createElement('span');
  closeLabel.className = 'label-close';
  closeLabel.textContent = 'Close';
  label.append(editLabel, closeLabel);
  button.append(icon('edit', d), icon('close', CROSS), label);
  return button;
}

/** Show a floating button as open or not: its X and Close, or its own icon and words. */
function setFloatOpen(button: HTMLElement, open: boolean): void {
  button.classList.toggle('is-open', open);
  button.setAttribute('aria-expanded', String(open));
  // Its words' cell as wide as the one showing; the stylesheet eases it.
  const label = button.querySelector<HTMLElement>('.float-button-label')!;
  const shown = label.querySelector<HTMLElement>(open ? '.label-close' : '.label-edit')!;
  label.style.width = `${shown.offsetWidth}px`;
}

/** A pencil: the shaft from tip to cap, then the line where the cap meets it. */
const PENCIL = 'M3 13l.6-3L10.5 3.1a1 1 0 0 1 1.4 0l1 1a1 1 0 0 1 0 1.4L6 12.4 3 13zM9.4 4.2l2.4 2.4';
/**
 * A paintbrush: the handle, a sliver from the top right, then the bristles
 * swelling from its foot to a tip at the bottom left.
 */
const BRUSH =
  'M13.7 2.3a1.2 1.2 0 0 0-1.7 0L6.6 7.9l2 2 5.2-5.9a1.2 1.2 0 0 0-.1-1.7z' +
  'M6.6 7.9c-1.7 0-2.9 1.1-3 2.8-.1 1.1-.6 1.9-1.6 2.4 2.8.9 6.1.1 6.6-3.2';
/** An X. */
const CROSS = 'M4 4l8 8M12 4l-8 8';
/** A gear: eight teeth round a rim, then the hole at its middle. */
const GEAR =
  'M6.90 3.43L7.21 1.75L8.79 1.75L9.10 3.43L10.46 3.99L11.86 3.02L12.98 4.14L12.01 5.54L12.57 6.90L14.25 7.21L14.25 8.79L12.57 9.10L12.01 10.46L12.98 11.86L11.86 12.98L10.46 12.01L9.10 12.57L8.79 14.25L7.21 14.25L6.90 12.57L5.54 12.01L4.14 12.98L3.02 11.86L3.99 10.46L3.43 9.10L1.75 8.79L1.75 7.21L3.43 6.90L3.99 5.54L3.02 4.14L4.14 3.02L5.54 3.99zM10.1 8a2.1 2.1 0 1 1-4.2 0a2.1 2.1 0 0 1 4.2 0z';

/** Right of the paper, outside it, level with its top: Page Setup. */
const pageTools = document.createElement('div');
pageTools.className = 'workspace-page-tools';
// A gear and Page Setup, a brush and Line Styles: each an X and Close while
// its card is open.
const pageSetup = floatButton(GEAR, 'Page Setup');
pageSetup.setAttribute('aria-label', 'Page setup');
const lineStyles = floatButton(BRUSH, 'Line Styles');
lineStyles.setAttribute('aria-label', 'Line styles');
const sideButtons = document.createElement('div');
sideButtons.className = 'workspace-side-buttons';
sideButtons.append(pageSetup, lineStyles);
/**
 * The card either button opens, under the two of them: it slides in from
 * the window's right edge. One at a time; the other button swaps what is
 * on it.
 */
const sideCard = document.createElement('div');
sideCard.className = 'workspace-side-card';
sideCard.inert = true;
pageTools.append(sideButtons, sideCard);

type SideCard = 'page' | 'lines';
const SIDE_BUTTONS: Record<SideCard, HTMLButtonElement> = { page: pageSetup, lines: lineStyles };
let sideOpen: SideCard | null = null;

/** Each button as an X while its card is the one open. */
function markSideButtons(): void {
  for (const [which, button] of Object.entries(SIDE_BUTTONS)) setFloatOpen(button, which === sideOpen);
}

/** How long the card takes to slide, in ms. */
const slideLength = () =>
  Math.max(...getComputedStyle(sideCard).transitionDuration.split(',').map(parseFloat)) * 1000;

/** How far past the window's edge the card waits, for its shadow, in px. */
const SLIDE_PAST = 24;

/**
 * The slide's easing, as the stylesheet has it in --slide-ease: how far
 * along it is, 0 to 1, at each share of its time.
 */
const SLIDE_EASE: [time: number, progress: number][] = [
  [0, 0],
  [0.18, 0.596],
  [0.382, 0.935],
  [0.482, 1.005],
  [0.596, 1.0215],
  [1, 1],
];

/** The share of the slide's time at which it is first `progress` along. */
function slideTimeAt(progress: number): number {
  for (let i = 1; i < SLIDE_EASE.length; i++) {
    const [t0, p0] = SLIDE_EASE[i - 1]!;
    const [t1, p1] = SLIDE_EASE[i]!;
    if (progress <= p1) return t0 + ((progress - p0) / (p1 - p0)) * (t1 - t0);
  }
  return 1;
}

/** Bumped on every open and close, so a slide waited on knows if it was overtaken. */
let sideTurn = 0;

/** Build a card from the sheet as it stands and slide it in. */
function slideSideIn(which: SideCard): void {
  sideCard.replaceChildren(
    which === 'page'
      ? createPageCard({ page: sheet.page, header: sheet.header, onReshape: reshape, onChange: () => redraw() })
      : createLineCard({ styles: sheet.lines, onChange: () => redraw() }),
  );
  sideCard.inert = false;
  // Put where it starts from at once, as the rows' card is: its left edge
  // at rest to the window's right edge, and a little more for its shadow.
  sideCard.style.transition = 'none';
  const left = pageTools.getBoundingClientRect().left + sideCard.offsetLeft;
  sideCard.style.setProperty('--slide', `${document.documentElement.clientWidth - left + SLIDE_PAST}px`);
  sideCard.getBoundingClientRect();
  sideCard.style.transition = '';
  sideCard.classList.add('is-open');
}

/**
 * Open a card. With the other one open, that one slides out first and
 * this one slides in after it.
 */
function openSide(which: SideCard): void {
  const wasOpen = sideOpen !== null;
  sideOpen = which;
  const turn = ++sideTurn;
  markSideButtons();
  if (!wasOpen) {
    slideSideIn(which);
    return;
  }
  sideCard.inert = true;
  sideCard.classList.remove('is-open');
  // The next card starts the moment this one is out of sight, not when its
  // slide ends: the slide runs on past the window's edge and settles
  // there, a beat with nothing to see.
  const left = pageTools.getBoundingClientRect().left + sideCard.offsetLeft;
  const toEdge = document.documentElement.clientWidth - left;
  const gone = slideTimeAt(toEdge / (toEdge + SLIDE_PAST));
  setTimeout(() => {
    if (turn === sideTurn) slideSideIn(which);
  }, slideLength() * gone);
}

/** Slide the card away. */
function closeSide(): void {
  if (sideOpen === null) return;
  sideOpen = null;
  const turn = ++sideTurn;
  sideCard.inert = true;
  sideCard.classList.remove('is-open');
  markSideButtons();
  // Slid away, the card is emptied, so it takes no room where it waits: a
  // tall one would otherwise make a short window scroll. After the slide's
  // length, not on its end, which a hidden tab never reports.
  setTimeout(() => {
    if (turn === sideTurn) sideCard.replaceChildren();
  }, slideLength());
}

for (const [which, button] of Object.entries(SIDE_BUTTONS) as [SideCard, HTMLButtonElement][]) {
  button.addEventListener('click', () => {
    if (sideOpen === which) closeSide();
    else openSide(which);
  });
}

// Escape closes the card, focus going back to its button.
sideCard.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || sideOpen === null) return;
  const button = SIDE_BUTTONS[sideOpen];
  closeSide();
  button.focus();
});

/** Which row's metrics card is open, 0-based; null when none is. */
let editing: number | null = null;

/**
 * The metrics card, left of the Edit buttons: a slot in the paper's cell
 * as theirs is, and in it the card, which slides in from the window's left
 * edge and back out. Its contents are built for the row it opens on.
 */
const cardSlot = document.createElement('div');
cardSlot.className = 'workspace-row-card-slot';
const card = document.createElement('div');
card.className = 'workspace-row-card';
card.inert = true;
cardSlot.append(card);

/**
 * Level with its row's Edit button, kept inside the stage; and how far left
 * it has to go to be out of the window.
 */
function placeCard(): void {
  if (editing === null) return;
  const edit = rowEdits.children[editing] as HTMLElement | undefined;
  if (!edit) return;
  const slot = cardSlot.getBoundingClientRect();
  const bounds = stage.getBoundingClientRect();
  const height = card.offsetHeight;
  const highest = bounds.top - slot.top;
  const lowest = bounds.bottom - slot.top - height;
  const centred = parseFloat(edit.style.top) - height / 2;
  card.style.top = `${Math.max(highest, Math.min(lowest, centred))}px`;
  // Its right edge at rest, from the window's left, and a little more for
  // its shadow.
  card.style.setProperty('--slide', `${-(slot.left + card.offsetLeft + card.offsetWidth + 24)}px`);
}

/** Open a row's metrics card; one already open moves to the new row. */
function openRow(index: number): void {
  // With shared metrics row 1's state is every row's.
  const state = sheet.metrics === 'same' ? sheet.rows[0]! : sheet.rows[index]!;
  editing = index;
  card.replaceChildren(
    createRowCard({ row: index + 1, state, styles: sheet.lines, onChange: () => redraw() }),
  );
  card.inert = false;
  if (!card.classList.contains('is-open')) {
    // Put where it starts from at once, not eased there: a start still
    // on its way from somewhere further off — the far side of the window,
    // the first time — would make the slide longer, so faster, and its
    // overshoot bigger.
    card.style.transition = 'none';
    placeCard();
    card.getBoundingClientRect();
    card.style.transition = '';
  } else {
    placeCard();
  }
  card.classList.add('is-open');
  markRowEdits();
}

/** Slide the card away. Its contents stay until it is next opened. */
function closeRow(): void {
  if (editing === null) return;
  editing = null;
  card.inert = true;
  card.classList.remove('is-open');
  markRowEdits();
}

/** Each Edit button as an X while its row's card is open. */
function markRowEdits(): void {
  Array.from(rowEdits.children).forEach((edit, i) => {
    const open = i === editing;
    setFloatOpen(edit as HTMLElement, open);
    edit.setAttribute('aria-label', open ? `Close row ${i + 1} metrics` : `Edit row ${i + 1} metrics`);
  });
}

// Escape closes the card, focus going back to the button that opened it.
card.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || editing === null) return;
  const edit = rowEdits.children[editing] as HTMLElement | undefined;
  closeRow();
  edit?.focus();
});

const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');
/** Each row's rise or landing starts this long after the row above's, in ms. */
const RISE_STAGGER = 40;

/** One Edit button, kept from redraw to redraw so it can animate. */
function createRowEdit(index: number): HTMLButtonElement {
  // A pencil and Edit Row, or an X and Close while its card is open.
  const edit = floatButton(PENCIL, 'Edit row');
  edit.classList.add('workspace-row-edit');
  edit.addEventListener('click', () => {
    if (editing === index) closeRow();
    else openRow(index);
  });
  // The rise over, hover answers at once again.
  edit.addEventListener('animationend', () => edit.classList.remove('is-rising'));
  return edit;
}

/**
 * An Edit button for each row drawn, centred on its band at the paper's
 * scale. With shared metrics only row 1's is active: the rest follow it.
 * The buttons are kept and updated in place, so one switched on rises off
 * the mat and one switched off lands on it, each a moment after the one
 * above it.
 */
function placeRowEdits(content: PreviewSheet): void {
  const { sheet: drawn } = content;
  const scale = parseFloat(paper.style.width) / drawn.page.width;
  const edits = Array.from(rowEdits.children) as HTMLButtonElement[];
  for (const edit of edits.splice(drawn.rows.length)) edit.remove();
  // A row no longer there, or now following row 1, has nothing to edit.
  if (editing !== null && (editing >= drawn.rows.length || (sheet.metrics === 'same' && editing > 0))) {
    closeRow();
  }

  // How many have started moving this redraw: each waits its turn.
  let moving = 0;
  drawn.rows.forEach((row, i) => {
    let edit = edits[i];
    const disabled = sheet.metrics === 'same' && row.index > 0;
    if (!edit) {
      edit = createRowEdit(row.index);
      edit.disabled = disabled;
      rowEdits.append(edit);
    } else if (edit.disabled !== disabled) {
      edit.classList.remove('is-rising', 'is-landing');
      if (!REDUCED_MOTION.matches) {
        edit.style.setProperty('--rise-delay', `${moving++ * RISE_STAGGER}ms`);
        edit.classList.add(disabled ? 'is-landing' : 'is-rising');
      }
      edit.disabled = disabled;
    }
    edit.style.top = `${((row.top + row.bottom) / 2) * scale}px`;
  });
  markRowEdits();
  // How wide a button is reading Edit Row: its width now, with its words'
  // cell — which may be mid-change — swapped for those words. The buttons
  // are placed by it, and the card stands clear of it.
  const first = rowEdits.firstElementChild as HTMLElement | null;
  if (first) {
    const label = first.querySelector<HTMLElement>('.float-button-label')!;
    const words = first.querySelector<HTMLElement>('.label-edit')!;
    const width = first.offsetWidth - label.offsetWidth + words.offsetWidth;
    sheetBox.style.setProperty('--edit-width', `${width}px`);
  }
  placeCard();
}

/** Hide the drawing and the Edit buttons while the paper changes shape. */
function setReshaping(on: boolean): void {
  frame.classList.toggle('is-reshaping', on);
  sheetBox.classList.toggle('is-reshaping', on);
}

/** Bumped on every reshape, so only the latest one fades the sheet back in. */
let reshapes = 0;

/**
 * Draw the sheet as it stands, as large as fits the stage — the middle
 * six columns under the top bar — below the bar over it.
 *
 * With `animate` — a new orientation or paper — the frame grows or shrinks
 * to the new shape, the drawing hidden while it does, and fades in once it
 * lands. Otherwise the frame takes its size at once.
 */
function redraw(animate = false): void {
  const content = sheetContent();
  if ('message' in content) {
    message.textContent = content.message;
    // A value being fixed in a card: the last good sheet stays, faded, so
    // it can't be mistaken for the values now in the fields, with what's
    // wrong said over it.
    if (frame.parentElement === sheetBox) {
      frame.classList.add('is-stale');
      frame.append(message);
      return;
    }
    sheetBox.replaceChildren(sheetBar, message, pageTools);
    return;
  }
  if (frame.parentElement !== sheetBox) {
    sheetBox.replaceChildren(sheetBar, frame, rowEdits, cardSlot, pageTools);
    // Nothing on screen to change from.
    animate = false;
  }
  // The paper's colour, as the sheet prints on it.
  const white = getComputedStyle(document.documentElement).getPropertyValue('--color-white').trim();
  // The stage's height less the bar's and the gap under it.
  const barHeight = sheetBar.offsetHeight + parseFloat(getComputedStyle(sheetBox).rowGap);
  drawSheetFitted(paper, { width: stage.clientWidth, height: stage.clientHeight - barHeight }, content, white);
  frame.classList.remove('is-stale');
  if (message.parentElement === frame) message.remove();
  placeRowEdits(content);
  // Its words' cell again, in case the web fonts have since loaded.
  markSideButtons();

  const reshape = ++reshapes;
  if (!animate) {
    setReshaping(false);
    frame.classList.add('is-instant');
    frame.style.width = paper.style.width;
    frame.style.height = paper.style.height;
    // Laid out at the new size before the transition comes back.
    frame.getBoundingClientRect();
    frame.classList.remove('is-instant');
    return;
  }
  setReshaping(true);
  frame.style.width = paper.style.width;
  frame.style.height = paper.style.height;
  // Fade the sheet in once the frame has its new shape: after the reshape's
  // length, so a hidden tab, which runs no transitions, still shows it.
  const length = Math.max(...getComputedStyle(frame).transitionDuration.split(',').map(parseFloat)) * 1000;
  setTimeout(() => {
    if (reshape === reshapes) setReshaping(false);
  }, length);
}

/** A new orientation or paper: the sheet changes shape before your eyes. */
const reshape = () => redraw(true);

// The stage's size follows the window, not the sheet, and the sheet follows it.
let stageSize = '';
new ResizeObserver(() => {
  const size = `${stage.clientWidth}x${stage.clientHeight}`;
  if (size === stageSize) return;
  stageSize = size;
  redraw();
}).observe(stage);

/** Build the page from the sheet, replacing what was there. */
function render(): void {
  // Over the paper: how many rows and whether they share their metrics on
  // the left, the page's setup on the right.
  const rowControls = document.createElement('div');
  rowControls.className = 'workspace-sheet-controls';
  rowControls.append(
    createRowCountTabs(sheet.rowCount, (count) => {
      sheet.rowCount = count;
      redraw();
    }),
    createChoiceToggle<RowMetrics>(
      'Metrics across rows',
      [
        { value: 'same', label: 'Same' },
        { value: 'different', label: 'Different' },
      ],
      sheet.metrics,
      (metrics) => {
        // Going individual, every row starts from the metrics they shared.
        if (metrics === 'different') {
          const shared = sheet.rows[0]!;
          sheet.rows = sheet.rows.map((row, i) => (i === 0 ? row : copyRowState(shared)));
        }
        sheet.metrics = metrics;
        redraw();
      },
    ),
  );
  sheetBar.replaceChildren(rowControls);

  // Above everything: the app's name. Upload Config is off the page for
  // now; its dialog stays, unopened.
  const appTitle = document.createElement('h1');
  appTitle.className = 'heading-h1 app-title';
  appTitle.textContent = 'Sheet-o-matic';
  const topBar = document.createElement('header');
  topBar.className = 'app-header';
  topBar.append(appTitle);

  // The top bar, then the sheet on the mat. The controls are being placed
  // again; until they are, the sheet is drawn as it stands.
  const next = document.createElement('div');
  next.className = 'rows workspace-view';
  next.append(topBar, stage);

  if (root) root.replaceWith(next);
  else document.querySelector('#app')!.prepend(next);
  root = next;

  redraw();
}

document.querySelector('#app')!.append(uploadDialog.element);
render();
// The buttons' words set wider or narrower once the web fonts load.
void document.fonts.ready.then(() => redraw());

// Shift+G shows the page grid, read live from the grid tokens. Development
// only; it isn't in a build.
if (import.meta.env.DEV) mountGridOverlay();
