import { mountGridOverlay } from './grid-overlay.js';
import { emptyHeaderText } from './header-panel.js';
import { mastersAgree, type FontMaster } from './import/font-source.js';
import { applyFontMetrics, readUpload } from './import/read-upload.js';
import { defaultLineStyles } from './line-styles.js';
import { ConfigError } from '../src/index.js';
import type { LabelText } from '../src/render/ops.js';
import { newRowState, rowInput, rowValues } from './row-input.js';
import { MAX_ROWS, createRowCountSlider } from './sheet-controls.js';
import { drawSheetFitted } from './sheet-canvas.js';
import type { SheetState } from './sheet-file.js';
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

function actionButton(label: string, run?: () => void, variant?: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = variant ? `action-button ${variant}` : 'action-button';
  button.textContent = label;
  // Read by the stylesheet to hold the width of the label at its hover
  // weight.
  button.dataset.label = label;
  if (run) button.addEventListener('click', run);
  return button;
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
    sheetBox.replaceChildren(sheetBar, message);
    return;
  }
  if (frame.parentElement !== sheetBox) {
    sheetBox.replaceChildren(sheetBar, frame);
    // Nothing on screen to change from.
    animate = false;
  }
  // The paper's colour, as the sheet prints on it.
  const white = getComputedStyle(document.documentElement).getPropertyValue('--color-white').trim();
  // The stage's height less the bar's and the gap under it.
  const barHeight = sheetBar.offsetHeight + parseFloat(getComputedStyle(sheetBox).rowGap);
  drawSheetFitted(paper, { width: stage.clientWidth, height: stage.clientHeight - barHeight }, content, white);

  const reshape = ++reshapes;
  if (!animate) {
    frame.classList.remove('is-reshaping');
    frame.classList.add('is-instant');
    frame.style.width = paper.style.width;
    frame.style.height = paper.style.height;
    // Laid out at the new size before the transition comes back.
    frame.getBoundingClientRect();
    frame.classList.remove('is-instant');
    return;
  }
  frame.classList.add('is-reshaping');
  frame.style.width = paper.style.width;
  frame.style.height = paper.style.height;
  // Fade the sheet in once the frame has its new shape: after the reshape's
  // length, so a hidden tab, which runs no transitions, still shows it.
  const length = Math.max(...getComputedStyle(frame).transitionDuration.split(',').map(parseFloat)) * 1000;
  setTimeout(() => {
    if (reshape === reshapes) frame.classList.remove('is-reshaping');
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
  // Over the paper: how many rows on the left, the page's setup on the
  // right.
  sheetBar.replaceChildren(
    createRowCountSlider(sheet.rowCount, (count) => {
      sheet.rowCount = count;
      redraw();
    }),
    // Not wired yet: what it opens is still to be placed.
    actionButton('Page Setup'),
  );

  // Bringing a config or a font in, at the top right.
  const inbound = document.createElement('div');
  inbound.className = 'sheet-actions is-inbound';
  // What it takes, beside it, so the button needn't be opened to find out.
  const inboundNote = document.createElement('p');
  inboundNote.className = 'body-sm sheet-actions-note';
  inboundNote.id = 'upload-note';
  inboundNote.textContent =
    'Drop in a .glyphs, .ufo or Sheet-o-matic config to set up your sheet automatically.';
  const uploadButton = actionButton('Upload Config', () => uploadDialog.open());
  uploadButton.setAttribute('aria-describedby', inboundNote.id);

  inbound.append(inboundNote, uploadButton);

  // Above everything: the app's name centred, Upload Config on the right.
  const appTitle = document.createElement('h1');
  appTitle.className = 'heading-h1 app-title';
  appTitle.textContent = 'Sheet-o-matic';
  const topBar = document.createElement('header');
  topBar.className = 'app-header';
  topBar.append(appTitle, inbound);

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

// Shift+G shows the page grid, read live from the grid tokens. Development
// only; it isn't in a build.
if (import.meta.env.DEV) mountGridOverlay();
