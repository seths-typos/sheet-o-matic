import type { LineStyle, MetricLine } from '../src/index.js';

/** Every line the sheet draws: the five metric lines and the slant lines. */
export type StyledLine = MetricLine | 'slant';

export type LineWeight = 1 | 2 | 3;

/** One line's look, as the panel offers it. Shared by every row. */
export interface LineChoice {
  weight: LineWeight;
  dashed: boolean;
  color: string;
}

export type LineStyles = Record<StyledLine, LineChoice>;

/** The lines in the panel's order, top of the band to bottom, then slant. */
export const STYLED_LINES: { type: StyledLine; name: string }[] = [
  { type: 'ascender', name: 'Ascender' },
  { type: 'capHeight', name: 'Cap height' },
  { type: 'xHeight', name: 'x-height' },
  { type: 'baseline', name: 'Baseline' },
  { type: 'descender', name: 'Descender' },
  { type: 'slant', name: 'Slant' },
];

/**
 * The three colours on offer: --color-black, --color-red and
 * --color-near-black in tokens.css. Hex here because config takes hex.
 */
export const LINE_COLORS: { value: string; name: string }[] = [
  { value: '#132322', name: 'Black' },
  { value: '#cb0106', name: 'Red' },
  { value: '#474848', name: 'Grey' },
];

/** Printed weight in points for each step. Thin is the engine's 0.5 pt. */
const WEIGHT_PT: Record<LineWeight, number> = { 1: 0.5, 2: 1, 3: 1.5 };

/** The engine's x-height dash. */
const DASH = [3, 3];

/**
 * The engine's defaults, as near as the panel can say them — x-height red
 * and dashed, the rest grey and solid, all thin — but for the baseline,
 * which the page starts heavier, black and medium, as the line letters sit
 * on. Slant's default grey (#999999) isn't on offer, so it starts as the
 * other lines' grey.
 */
export function defaultLineStyles(): LineStyles {
  const plain = (): LineChoice => ({ weight: 1, dashed: false, color: '#474848' });
  return {
    ascender: plain(),
    capHeight: plain(),
    xHeight: { weight: 1, dashed: true, color: '#cb0106' },
    baseline: { weight: 2, dashed: false, color: '#132322' },
    descender: plain(),
    slant: plain(),
  };
}

/** A choice as config's `LineStyle`, less `visible`, which each row owns. */
export function toLineStyle(choice: LineChoice): Omit<LineStyle, 'visible'> {
  return {
    weight: WEIGHT_PT[choice.weight],
    color: choice.color,
    dash: choice.dashed ? [...DASH] : null,
  };
}
