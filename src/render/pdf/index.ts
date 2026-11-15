import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { SheetConfig } from '../../config/types.js';
import type { Sheet } from '../../geometry/types.js';
import { drawOps, type DrawOp, type DrawOptions, type DrawText } from '../ops.js';

export { DEFAULT_HEADER_TEXT_STYLE, drawOps } from '../ops.js';
export type { DrawLine, DrawOp, DrawOptions, DrawText, HeaderTextStyle } from '../ops.js';
export { parseHexColor } from '../color.js';
export type { Rgb } from '../color.js';

/**
 * A line of text drawn elsewhere, for the PDF to place as a picture. In pt,
 * as it sits on the page.
 */
export interface TextImage {
  png: Uint8Array;
  width: number;
  height: number;
  /** From the picture's left edge to where the text starts. */
  inset: number;
  /** From the picture's top down to the text's baseline. */
  ascent: number;
  /** The text's set width, which it is aligned by. */
  advance: number;
}

/**
 * Draws a line of text the PDF's own font can't set. Nothing back leaves
 * the line to that font, which refuses it.
 */
export type DrawTextImage = (op: DrawText) => TextImage | undefined | Promise<TextImage | undefined>;

/**
 * Geometry output in, PDF bytes out.
 *
 * The only module that imports a PDF library. Owns page creation, the y-axis
 * flip, and turning draw ops into pdf-lib calls.
 *
 * Text is set in standard Helvetica, which holds Western European
 * characters only. A line with any other — Vietnamese, Greek, an arrow —
 * goes to `textImage`, if given: the caller draws it with fonts of its own
 * and it is placed as a picture, where the text would have been. The
 * front end does, with the browser's. Without `textImage` such a line
 * throws, as pdf-lib does.
 */
export async function renderSheetPdf(
  sheet: Sheet,
  config: SheetConfig,
  options: DrawOptions = {},
  textImage?: DrawTextImage,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([sheet.page.width, sheet.page.height]);
  const ops = drawOps(sheet, config, options);

  // Standard 14 font, so nothing is embedded unless the header needs it.
  const font = ops.some((op) => op.kind === 'text')
    ? await doc.embedFont(StandardFonts.Helvetica)
    : undefined;

  // Ops arrive in geometry space, top-left origin with y running down. PDF
  // measures up from the bottom-left, so this is where the flip happens.
  const flip = (y: number) => sheet.page.height - y;

  for (const op of ops) {
    const image =
      op.kind === 'text' && font && textImage && !canSet(font, op.text)
        ? await textImage(op)
        : undefined;
    if (image && op.kind === 'text') {
      const capHeight = font!.heightAtSize(op.size, { descender: false });
      const left =
        op.align === 'right' ? op.x - image.advance : op.align === 'center' ? op.x - image.advance / 2 : op.x;
      const baseline = op.anchor === 'center' ? flip(op.y) - capHeight / 2 : flip(op.y);
      page.drawImage(await doc.embedPng(image.png), {
        x: left - image.inset,
        y: baseline - (image.height - image.ascent),
        width: image.width,
        height: image.height,
      });
      continue;
    }
    draw(page, op, font, flip);
  }

  return doc.save();
}

type Page = ReturnType<PDFDocument['addPage']>;
type Font = Awaited<ReturnType<PDFDocument['embedFont']>>;

/** Whether the font has every character of `text`. */
function canSet(font: Font, text: string): boolean {
  try {
    font.encodeText(text);
    return true;
  } catch {
    return false;
  }
}

function draw(page: Page, op: DrawOp, font: Font | undefined, flip: (y: number) => number): void {
  if (op.kind === 'line') {
    page.drawLine({
      start: { x: op.start.x, y: flip(op.start.y) },
      end: { x: op.end.x, y: flip(op.end.y) },
      thickness: op.thickness,
      color: rgb(op.color.r, op.color.g, op.color.b),
      ...(op.dash ? { dashArray: op.dash } : {}),
    });
    return;
  }

  // Alignment is resolved here rather than in draw.ts because it needs the
  // font's metrics. A canvas renderer measures its own the same way.
  const width = font ? font.widthOfTextAtSize(op.text, op.size) : 0;
  const capHeight = font ? font.heightAtSize(op.size, { descender: false }) : op.size;

  page.drawText(op.text, {
    x: op.align === 'right' ? op.x - width : op.align === 'center' ? op.x - width / 2 : op.x,
    y: op.anchor === 'center' ? flip(op.y) - capHeight / 2 : flip(op.y),
    size: op.size,
    font,
    color: rgb(op.color.r, op.color.g, op.color.b),
  });
}
