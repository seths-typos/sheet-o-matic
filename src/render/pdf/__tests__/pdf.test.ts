import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildSheet } from '../../../geometry/index.js';
import { baseConfig } from '../../../testing/fixtures.js';
import { DEFAULT_HEADER_TEXT_STYLE, renderSheetPdf } from '../index.js';
import { createSheetPdf } from '../../../index.js';
import { contentStream, strokeCount, textShown } from '../../../testing/pdf.js';

describe('renderSheetPdf', () => {
  it('returns bytes that are a PDF', async () => {
    const config = baseConfig();
    const bytes = await renderSheetPdf(buildSheet(config), config);

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('produces one page at the sheet dimensions', async () => {
    const config = baseConfig();
    const bytes = await renderSheetPdf(buildSheet(config), config);
    const reloaded = await PDFDocument.load(bytes);

    expect(reloaded.getPageCount()).toBe(1);

    const { width, height } = reloaded.getPage(0).getSize();
    expect(width).toBeCloseTo(792, 6);
    expect(height).toBeCloseTo(612, 6);
  });

  it('follows the page preset into portrait', async () => {
    const config = baseConfig();
    config.page = { width: 612, height: 792, margins: config.page.margins };

    const bytes = await renderSheetPdf(buildSheet(config), config);
    const { width, height } = (await PDFDocument.load(bytes)).getPage(0).getSize();

    expect(width).toBeCloseTo(612, 6);
    expect(height).toBeCloseTo(792, 6);
  });

  it('strokes one path per visible line', async () => {
    const config = baseConfig();
    const sheet = buildSheet(config);
    const content = await contentStream(await renderSheetPdf(sheet, config));

    expect(strokeCount(content)).toBe(sheet.rows.length * 5);
  });

  it('drops a stroke for every line switched to invisible', async () => {
    const config = baseConfig();
    config.lines.xHeight.visible = false;
    config.lines.descender.visible = false;

    const sheet = buildSheet(config);
    const content = await contentStream(await renderSheetPdf(sheet, config));

    expect(strokeCount(content)).toBe(sheet.rows.length * 3);
  });

  it('writes each style through to the stroke operators', async () => {
    const config = baseConfig();
    const content = await contentStream(await renderSheetPdf(buildSheet(config), config));

    // X-height is #cb0106, the other metrics #474848. All are 0.5 pt.
    expect(content).toContain(`${0x47 / 255} ${0x48 / 255} ${0x48 / 255} RG`);
    expect(content).toContain(`${0xcb / 255} ${0x01 / 255} ${0x06 / 255} RG`);
    expect(content).toContain('0.5 w');
    expect(content).not.toContain('\n1 w\n');
  });

  it('sets a dash pattern for dashed styles and clears it for solid ones', async () => {
    const config = baseConfig();
    config.lines.xHeight.dash = [3, 2];

    const content = await contentStream(await renderSheetPdf(buildSheet(config), config));

    expect(content).toContain('[3 2] 0 d');
    expect(content).toContain('[] 0 d');
  });

  it('shows header text only when there is header text', async () => {
    const plain = baseConfig();
    plain.labels.enabled = false;
    const titled = baseConfig();
    titled.labels.enabled = false;
    titled.header.enabled = true;
    titled.header.left = 'Type Cooker brief';

    const without = await contentStream(await renderSheetPdf(buildSheet(plain), plain));
    const withText = await contentStream(await renderSheetPdf(buildSheet(titled), titled));

    expect(textShown(withText)).toEqual(['Type Cooker brief']);
    expect(textShown(without)).toEqual([]);
  });

  it('places the header baseline where the flip puts it', async () => {
    const config = baseConfig();
    config.labels.enabled = false;
    config.header.enabled = true;
    config.header.left = 'brief';

    const content = await contentStream(await renderSheetPdf(buildSheet(config), config));

    // Block top at y 36 from the page top, first baseline a 12 pt size below,
    // flipped into a 612 pt tall page.
    expect(content).toContain('1 0 0 1 36 564 Tm');
  });

  it('shows each line of a multi-line header', async () => {
    const config = baseConfig();
    config.labels.enabled = false;
    config.header.enabled = true;
    config.header.left = 'brief\ndate';

    const content = await contentStream(await renderSheetPdf(buildSheet(config), config));

    expect(textShown(content)).toEqual(['brief', 'date']);
  });
});

describe('renderSheetPdf — labels', () => {
  it('right-aligns each label into the margin using the font metrics', async () => {
    const config = baseConfig();
    const content = await contentStream(await renderSheetPdf(buildSheet(config), config));

    expect(textShown(content)).toContain('B');
    expect(textShown(content)).toContain('C');
    expect(textShown(content)).toContain('X');

    // Helvetica 'B' at 6 pt is 4 pt wide, so a right edge at x 30 starts at 26.
    const placements = [...content.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/g)];
    const xs = placements.map(([, x]) => Number(x));

    expect(Math.max(...xs)).toBeLessThan(30);
    expect(Math.min(...xs)).toBeGreaterThan(0);
  });
});

describe('renderSheetPdf — text Helvetica cannot set', () => {
  // A 1 x 1 transparent PNG.
  const PNG = Uint8Array.from(
    atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
    (c) => c.charCodeAt(0),
  );
  const image = { png: PNG, width: 40, height: 14, inset: 2, ascent: 10, advance: 36 };

  const withHeader = (left: string) => {
    const config = baseConfig();
    config.header.enabled = true;
    config.header.left = left;
    // The header's is the only text.
    config.labels.enabled = false;
    return config;
  };

  it('throws without a way to draw it', async () => {
    const config = withHeader('Tiếng Việt →');

    await expect(renderSheetPdf(buildSheet(config), config)).rejects.toThrow(/cannot encode/);
  });

  it('places the caller\'s picture of the line instead', async () => {
    const config = withHeader('Tiếng Việt →');
    const asked: string[] = [];

    const bytes = await renderSheetPdf(buildSheet(config), config, {}, (op) => {
      asked.push(op.text);
      return image;
    });
    const content = await contentStream(bytes);

    expect(asked).toEqual(['Tiếng Việt →']);
    // The picture, 40 x 14 pt, its left edge the inset left of the margin:
    // Moved to its bottom-left corner, then scaled to its size. The corner
    // is the inset left of the margin, and as far under the baseline as
    // the picture runs below it: 14 - 10 pt.
    const [, x, y] = content.match(/1 0 0 1 ([\d.]+) ([\d.]+) cm\n1 0 0 1 0 0 cm\n40 0 0 14 0 0 cm/) ?? [];
    const baseline = config.page.height - (config.page.margins.top + DEFAULT_HEADER_TEXT_STYLE.size);
    expect(Number(x)).toBeCloseTo(config.page.margins.left - 2, 6);
    expect(Number(y)).toBeCloseTo(baseline - 4, 6);
    expect(content).toMatch(/\/Image-\d+ Do/);
    // And not as text.
    expect(textShown(content)).toEqual([]);
  });

  it('leaves a line Helvetica can set to Helvetica', async () => {
    const config = withHeader('Café — “brief”');
    let asked = 0;

    const bytes = await renderSheetPdf(buildSheet(config), config, {}, () => {
      asked++;
      return image;
    });

    expect(asked).toBe(0);
    expect(textShown(await contentStream(bytes)).length).toBe(1);
  });
});

describe('createSheetPdf', () => {
  it('goes from config straight to PDF bytes', async () => {
    const bytes = await createSheetPdf(baseConfig());

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('matches building the geometry and rendering it separately', async () => {
    const config = baseConfig();

    const direct = await createSheetPdf(config);
    const staged = await renderSheetPdf(buildSheet(config), config);

    expect(direct.byteLength).toBe(staged.byteLength);
  });
});
