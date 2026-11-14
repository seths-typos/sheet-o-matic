import { DEFAULTS, buildSheet, resolveConfig } from '../src/index.js';
import type { LineType, MetricLine, Sheet, SheetConfig, SheetInput } from '../src/index.js';
import type { DrawOptions, LabelText } from '../src/render/ops.js';
import { emptyHeaderText, type HeaderText } from './header-panel.js';
import type { Orientation, PagePreset } from '../src/index.js';

/** The paper the sheet is set on. */
export interface PageSetup {
  size: PagePreset;
  orientation: Orientation;
  /** pt, the same on all four sides. */
  margin: number;
  /** Each metric line's value, in font units, set in the left margin. */
  values: boolean;
}

export function defaultPageSetup(): PageSetup {
  return { size: 'letter', orientation: 'landscape', margin: DEFAULTS.page.margins.top, values: true };
}

export interface PreviewSheet {
  sheet: Sheet;
  config: SheetConfig;
  /** How its text is set, for every renderer. */
  options: DrawOptions;
  /** For renderers that name a font: the PDF sets Helvetica, Arial's twin. */
  fontFamily: string;
  /** The page setup it was made on, as the user chose it. */
  page: PageSetup;
}

/** Header text: 10 pt Arial. */
export const HEADER_TEXT = { size: 10, lineHeight: 12, color: '#000000' };
export const HEADER_FONT = 'Arial, Helvetica, sans-serif';

/**
 * Room reserved for the header below the top margin: its 10 pt line, and
 * a gap before the first row.
 */
export const HEADER_HEIGHT = 24;

/**
 * Helvetica's advance widths, in thousandths of the type size, for what a
 * metric value is made of: digits, a hyphen-minus, a point. Arial's are the
 * same, so the preview and the PDF agree.
 */
const DIGIT_WIDTH = 556;
const GLYPH_WIDTHS: Record<string, number> = { '-': 333, '.': 278 };

/** A metric value's set width, in pt. */
function valueWidth(text: string): number {
  let width = 0;
  for (const glyph of text) width += GLYPH_WIDTHS[glyph] ?? DIGIT_WIDTH;
  return (width / 1000) * DEFAULTS.labels.size;
}

/**
 * The room the metric values take at the left of the rows, in pt: the
 * widest value on a drawn line, in any row, and its gap from the line. One
 * room for the whole sheet, so every row's lines start together. 0 when
 * there is nothing to set.
 */
export function valuesRoom(inputs: SheetInput[], values: LabelText[]): number {
  let widest = 0;
  inputs.forEach((input, index) => {
    for (const [type, text] of Object.entries(values[index] ?? {})) {
      if (!text || input.lines?.[type as MetricLine]?.visible === false) continue;
      widest = Math.max(widest, valueWidth(text));
    }
  });
  return widest > 0 ? widest + DEFAULTS.labels.gap : 0;
}

/**
 * The printed sheet: on `page`, `inputs.length` rows filling it, each
 * row drawn from its own input. With `page.values` on, each row's lines are
 * labelled with `values` — its own, as rows can differ — and otherwise
 * they go unlabelled. The values sit inside the left margin, not in it: the
 * lines start `valuesRoom` further in to leave them room, and run from the
 * margin itself when there are none. Decided 2026-11-14; the values used
 * to hang in the margin.
 *
 * `room` is how much of that room is held, 0 to 1 — the lines part way
 * between the two while they move from one to the other. The values are
 * set only once it is all there. Slant lines stay where they are on the
 * page whatever the room: only their left ends are trimmed.
 *
 * The engine takes one set of metrics for the whole sheet, so this builds a
 * sheet per row and keeps only that row from each. That works because in
 * row-count mode every row band is the same height, whatever its metrics —
 * the band is set by the row count, the cap height solved to fit it — so a
 * row lands in the same place on every one of those sheets.
 *
 * Line styles are shared by every row; only visibility differs, so each
 * row's hidden lines are dropped here and the combined config draws every
 * line it is given. A dropped line takes its label with it, as the
 * renderer only labels lines that are there.
 */
export function previewSheet(
  inputs: SheetInput[],
  headerText: HeaderText = emptyHeaderText(),
  page: PageSetup = defaultPageSetup(),
  values: LabelText[] = [],
  room: number = page.values ? 1 : 0,
): PreviewSheet {
  const rowCount = inputs.length;
  if (rowCount === 0) throw new Error('A sheet needs at least one row.');

  // Reserved only when there's something to put in it; it takes from the
  // rows' height, the same on every per-row sheet.
  const enabled = Object.values(headerText).some((text) => text.trim() !== '');
  const header = { enabled, height: HEADER_HEIGHT, ...headerText };

  const held = valuesRoom(inputs, values) * room;

  const built = inputs.map((input, index) => {
    const config = resolveConfig({
      ...input,
      page: {
        ...input.page,
        size: page.size,
        orientation: page.orientation,
        margins: { top: page.margin, right: page.margin, bottom: page.margin, left: page.margin + held },
      },
      // Anchored the same distance from the margin, not from the lines' start.
      slant: { ...input.slant, inset: DEFAULTS.slant.inset - held },
      metrics: { ...input.metrics, mode: 'rowCount', rowCount },
      labels: { enabled: false },
      header,
    });
    const row = buildSheet(config).rows[index]!;
    const shown = (type: LineType) =>
      type === 'slant' ? config.slant.style.visible : config.lines[type].visible;

    return { config, row: { ...row, lines: row.lines.filter((line) => shown(line.type)) } };
  });

  const first = built[0]!.config;
  const config: SheetConfig = {
    ...first,
    lines: Object.fromEntries(
      Object.entries(first.lines).map(([type, style]) => [type, { ...style, visible: true }]),
    ) as SheetConfig['lines'],
    slant: { ...first.slant, style: { ...first.slant.style, visible: true } },
    labels: { ...first.labels, enabled: page.values && room === 1 },
  };

  // The header keeps to the margin: the values' room is the rows' alone.
  const whole = buildSheet(first);
  const headerBlock = whole.header && {
    ...whole.header,
    x: whole.header.x - held,
    width: whole.header.width + held,
  };

  return {
    sheet: { ...whole, header: headerBlock, rows: built.map((b) => b.row) },
    config,
    options: { header: HEADER_TEXT, labelText: values },
    fontFamily: HEADER_FONT,
    page: { ...page },
  };
}
