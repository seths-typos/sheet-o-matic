import type { TextImage } from '../src/index.js';
import { toCss } from '../src/render/canvas/index.js';
import type { DrawText } from '../src/render/ops.js';

/** Pixels to the point: 600 to the inch, sharp in print. */
const SCALE = 600 / 72;
/** The longest side a canvas is safely given, in px. */
const LONGEST = 16000;

/**
 * A line of text as a picture, drawn by the browser in `fontFamily`.
 *
 * For text the PDF's Helvetica can't set. The browser falls back, character
 * by character, to whatever font on the machine has it, so any text the
 * page can show — Vietnamese, Greek, Japanese, an emoji — can be saved,
 * as it looks in the preview.
 */
export async function textImage(op: DrawText, fontFamily: string): Promise<TextImage | undefined> {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return undefined;

  let scale = SCALE;
  const measure = () => {
    context.font = `${op.size * scale}px ${fontFamily}`;
    const m = context.measureText(op.text);
    // The text's ink can run past its set width and its font's height, as
    // an italic's or an emoji's does: the picture takes in both, and a
    // pixel over for the edges' softening.
    return {
      advance: m.width,
      left: Math.ceil(Math.max(0, m.actualBoundingBoxLeft)) + 1,
      right: Math.ceil(Math.max(m.width, m.actualBoundingBoxRight)) + 1,
      ascent: Math.ceil(Math.max(m.fontBoundingBoxAscent ?? 0, m.actualBoundingBoxAscent)) + 1,
      descent: Math.ceil(Math.max(m.fontBoundingBoxDescent ?? 0, m.actualBoundingBoxDescent)) + 1,
    };
  };
  let box = measure();
  // A line too long for a canvas at this scale is drawn smaller.
  const longest = Math.max(box.left + box.right, box.ascent + box.descent);
  if (longest > LONGEST) {
    scale *= LONGEST / longest;
    box = measure();
  }

  canvas.width = box.left + box.right;
  canvas.height = box.ascent + box.descent;
  // Sizing a canvas resets its context.
  context.font = `${op.size * scale}px ${fontFamily}`;
  context.fillStyle = toCss(op.color);
  context.textBaseline = 'alphabetic';
  context.fillText(op.text, box.left, box.ascent);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return undefined;
  return {
    png: new Uint8Array(await blob.arrayBuffer()),
    width: canvas.width / scale,
    height: canvas.height / scale,
    inset: box.left / scale,
    ascent: box.ascent / scale,
    advance: box.advance / scale,
  };
}
