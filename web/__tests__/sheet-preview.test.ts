import { describe, expect, it } from 'vitest';
import { DEFAULT_FONT_UNITS } from '../../src/index.js';
import { defaultLineStyles } from '../line-styles.js';
import { drawOps } from '../../src/render/ops.js';
import { rowInput, rowValues, type RowState } from '../row-input.js';
import { defaultPageSetup, previewSheet, valuesRoom } from '../sheet-preview.js';

const row = (patch: Partial<RowState> = {}): RowState => ({
  units: { ...DEFAULT_FONT_UNITS },
  visible: { ascender: true, capHeight: true, xHeight: true, baseline: true, descender: true },
  slant: { enabled: true, angle: 30 },
  ...patch,
});

const input = (state: RowState) => rowInput(state, defaultLineStyles())!;

describe('previewSheet', () => {
  it('draws one row per input on a landscape page', () => {
    const { sheet } = previewSheet([input(row()), input(row()), input(row())]);
    expect(sheet.rows).toHaveLength(3);
    expect(sheet.page.width).toBeGreaterThan(sheet.page.height);
  });

  it('labels each row\'s lines with its own values, or leaves them off', () => {
    const tall = row({ units: { ascender: 900, capHeight: 600, xHeight: 300, descender: -300 } });
    const states = [row(), tall];
    const values = states.map(rowValues);
    const shown = previewSheet(states.map(input), undefined, defaultPageSetup(), values);
    const texts = drawOps(shown.sheet, shown.config, shown.options)
      .filter((op) => op.kind === 'text')
      .map((op) => op.text);

    expect(texts).toEqual(['800', '700', '500', '0', '-200', '900', '600', '300', '0', '-300']);

    const hidden = previewSheet(states.map(input), undefined, { ...defaultPageSetup(), values: false }, values);
    expect(hidden.config.labels.enabled).toBe(false);
  });

  it('leaves a switched-off line unlabelled', () => {
    const state = row({
      visible: { ascender: false, capHeight: true, xHeight: true, baseline: true, descender: true },
    });
    const { sheet, config, options } = previewSheet([input(state)], undefined, defaultPageSetup(), [
      rowValues(state),
    ]);
    const texts = drawOps(sheet, config, options).filter((op) => op.kind === 'text');
    expect(texts.map((op) => op.text)).toEqual(['700', '500', '0', '-200']);
  });

  it('gives every row the same band, whatever its metrics', () => {
    const tall = row({ units: { ascender: 900, capHeight: 600, xHeight: 300, descender: -300 } });
    const { sheet } = previewSheet([input(row()), input(tall)]);
    const [a, b] = sheet.rows;
    expect(b!.bottom - b!.top).toBeCloseTo(a!.bottom - a!.top, 6);
    expect(b!.top).toBeGreaterThan(a!.bottom);
  });

  it("places each row's metrics by its own input", () => {
    const low = row({ units: { ...DEFAULT_FONT_UNITS, xHeight: 300 } });
    const { sheet } = previewSheet([input(row()), input(low)]);
    const xHeightOffset = (i: number) => {
      const r = sheet.rows[i]!;
      return r.baseline - r.lines.find((line) => line.type === 'xHeight')!.start.y;
    };
    expect(xHeightOffset(1)).toBeLessThan(xHeightOffset(0));
  });

  it("drops a row's hidden lines but keeps them in the others", () => {
    const noX = row({
      visible: { ascender: true, capHeight: true, xHeight: false, baseline: true, descender: true },
    });
    const { sheet, config } = previewSheet([input(row()), input(noX)]);
    const types = (i: number) => new Set(sheet.rows[i]!.lines.map((line) => line.type));
    expect(types(0).has('xHeight')).toBe(true);
    expect(types(1).has('xHeight')).toBe(false);
    expect(config.lines.xHeight.visible).toBe(true);
  });

  it('keeps slant lines only on rows with an italic angle', () => {
    const upright = row({ slant: { enabled: false, angle: null } });
    const { sheet } = previewSheet([input(row()), input(upright)]);
    const slants = (i: number) => sheet.rows[i]!.lines.filter((line) => line.type === 'slant').length;
    expect(slants(0)).toBeGreaterThan(0);
    expect(slants(1)).toBe(0);
  });

  it('reserves the header only when it has text, and sets it at 10 pt', () => {
    const plain = previewSheet([input(row())]);
    const titled = previewSheet([input(row())], { left: '', center: 'brief', right: '' });

    expect(plain.config.header.enabled).toBe(false);
    expect(titled.config.header.enabled).toBe(true);
    expect(titled.sheet.rows[0]!.top).toBeGreaterThan(plain.sheet.rows[0]!.top);
    expect(titled.options.header?.size).toBe(10);
  });

  it('sets the sheet on the page setup it is given', () => {
    const { sheet } = previewSheet([input(row())], undefined, {
      size: 'a4',
      orientation: 'portrait',
      margin: 36,
      values: true,
    });

    expect(sheet.page.width).toBeCloseTo(595.28, 1);
    expect(sheet.page.height).toBeCloseTo(841.89, 1);
  });

  it('defaults to Letter, landscape', () => {
    const { sheet } = previewSheet([input(row())]);

    expect([sheet.page.width, sheet.page.height]).toEqual([792, 612]);
  });

  it('sets every margin to the page setup\'s one value', () => {
    const { config } = previewSheet([input(row())], undefined, {
      size: 'letter',
      orientation: 'landscape',
      margin: 54,
      values: true,
    });

    expect(config.page.margins).toEqual({ top: 54, right: 54, bottom: 54, left: 54 });
  });

  describe('the metric values\' room', () => {
    const states = [row()];
    const values = states.map(rowValues);
    const off = { ...defaultPageSetup(), values: false };
    const metricStarts = (content: ReturnType<typeof previewSheet>) =>
      content.sheet.rows[0]!.lines.filter((line) => line.type !== 'slant').map((line) => line.start.x);

    // "-200" at 6 pt: a hyphen and three digits, then the 6 pt gap.
    const room = ((333 + 3 * 556) / 1000) * 6 + 6;

    it('is the widest value on a drawn line and its gap', () => {
      expect(valuesRoom(states.map(input), values)).toBeCloseTo(room, 6);

      const noDescender = row({ visible: { ...row().visible, descender: false } });
      expect(valuesRoom([input(noDescender)], [rowValues(noDescender)])).toBeCloseTo((3 * 556 / 1000) * 6 + 6, 6);
      expect(valuesRoom(states.map(input), [])).toBe(0);
    });

    it('starts the lines after the values, the widest at the margin', () => {
      const shown = previewSheet(states.map(input), undefined, defaultPageSetup(), values);
      for (const x of metricStarts(shown)) expect(x).toBeCloseTo(36 + room, 6);

      const texts = drawOps(shown.sheet, shown.config, shown.options).filter((op) => op.kind === 'text');
      // Right-aligned a gap short of the lines: the widest reaches the margin.
      for (const op of texts) expect(op.x).toBeCloseTo(36 + room - 6, 6);
    });

    it('runs the lines from the margin with the values off', () => {
      const hidden = previewSheet(states.map(input), undefined, off, values);
      for (const x of metricStarts(hidden)) expect(x).toBe(36);
    });

    it('holds part of the room on the way, the values not yet set', () => {
      const half = previewSheet(states.map(input), undefined, defaultPageSetup(), values, 0.5);
      for (const x of metricStarts(half)) expect(x).toBeCloseTo(36 + room / 2, 6);
      expect(half.config.labels.enabled).toBe(false);
    });

    it('leaves the slant lines and the header where they were', () => {
      const text = { left: 'Brief', center: '', right: '' };
      const shown = previewSheet(states.map(input), text, defaultPageSetup(), values);
      const hidden = previewSheet(states.map(input), text, off, values);

      expect(shown.sheet.header!.x).toBeCloseTo(36, 6);
      expect(shown.sheet.header!.width).toBeCloseTo(hidden.sheet.header!.width, 6);

      // The same lines, less any trimmed away at the left.
      const ends = (content: typeof shown) =>
        content.sheet.rows[0]!.lines.filter((line) => line.type === 'slant').map((line) => line.end.x);
      const kept = ends(shown);
      for (const x of kept.slice(-5)) {
        expect(ends(hidden).some((other) => Math.abs(other - x) < 1e-6)).toBe(true);
      }
    });
  });
});
