import { drawSheetToCanvas } from '../src/render/canvas/index.js';
import type { PreviewSheet } from './sheet-preview.js';

/** The paper's outline width in CSS px: --border-thick. */
export const OUTLINE = 2;

/** The space a sheet is fitted to, in CSS px. */
export interface FitBox {
  width: number;
  height: number;
}

/**
 * Draw a sheet into `canvas`, the page as large as fits `box` with room
 * for its outline, sharp at the screen's pixel density. `background` is the
 * paper's colour.
 */
export function drawSheetFitted(
  canvas: HTMLCanvasElement,
  box: FitBox,
  content: PreviewSheet,
  background: string,
): void {
  const { sheet, config, options, fontFamily } = content;
  // Room for the paper's outline, drawn outside it.
  const room = 2 * OUTLINE;
  const fit = Math.max(
    0,
    Math.min(
      (box.width - room) / sheet.page.width,
      (box.height - room) / sheet.page.height,
    ),
  );
  const dpr = window.devicePixelRatio || 1;

  // Whole device pixels, rounded down, and shown at exactly that size.
  // The paper is filled to the page's scaled size, so a canvas rounded up
  // would leave its last column part filled, a grey seam against the
  // outline; one shown a fraction over would stretch that column likewise.
  canvas.width = Math.floor(sheet.page.width * fit * dpr);
  canvas.height = Math.floor(sheet.page.height * fit * dpr);
  canvas.style.width = `${canvas.width / dpr}px`;
  canvas.style.height = `${canvas.height / dpr}px`;

  drawSheetToCanvas(canvas.getContext('2d')!, sheet, config, {
    ...options,
    fontFamily,
    scale: fit * dpr,
    background,
  });
}
