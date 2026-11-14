import { renderSheetPdf } from '../src/index.js';
import { sheetToSvg } from '../src/render/svg/index.js';
import type { PageSetup, PreviewSheet } from './sheet-preview.js';

/** Each paper as CSS names it in `@page { size }`. */
const PAPER_KEYWORD: Record<PageSetup['size'], string> = { letter: 'letter', a4: 'A4' };

/**
 * Whether this browser prints a page on its own terms. WebKit — Safari, and
 * every browser on iOS — does: its dialog stays on portrait whatever
 * `@page { size }` says, and keeps its own margins, headers and footers, so
 * a sheet at its true size is cut off and runs onto a second page. Told
 * from the user agent, as there is nothing to test for.
 */
const PRINTS_ITS_OWN_WAY =
  /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(navigator.userAgent);

/**
 * Print the sheet through the browser's print dialog.
 *
 * The sheet goes on the page as SVG at its true size, in points, and a print
 * stylesheet shows only it, on a page of its size with no margins — the
 * sheet carries its own. Taken off the page again once the dialog closes.
 *
 * Where the browser won't print a page that way, the sheet is opened as a
 * PDF instead, to print from there: a PDF carries its own page size and
 * orientation, which the browser's PDF viewer keeps to.
 */
export function printSheet(content: PreviewSheet): void {
  if (PRINTS_ITS_OWN_WAY) {
    void openSheetPdf(content);
    return;
  }
  const { sheet, config, options, fontFamily, page: setup } = content;

  const holder = document.createElement('div');
  holder.className = 'print-sheet';
  holder.innerHTML = sheetToSvg(sheet, config, { ...options, fontFamily });

  // @page can't take a custom property, so the size is written in — by
  // the paper's name and its orientation, not as two lengths. A browser
  // takes a named paper turned landscape as the dialog's paper and
  // orientation; from bare lengths it may still offer its default, portrait.
  const page = document.createElement('style');
  page.textContent = `@page { size: ${PAPER_KEYWORD[setup.size]} ${setup.orientation}; margin: 0; }`;

  document.head.append(page);
  document.body.append(holder);

  const cleanUp = () => {
    holder.remove();
    page.remove();
  };
  window.addEventListener('afterprint', cleanUp, { once: true });
  window.print();
}

/** The sheet as a PDF, at a URL good until it is let go. */
async function sheetPdfUrl({ sheet, config, options }: PreviewSheet): Promise<string> {
  const bytes = await renderSheetPdf(sheet, config, options);
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
}

/**
 * Open the sheet as a PDF in a new tab. The tab is opened at once, while
 * the click that asked for it still counts — one opened after the PDF is
 * made would be blocked as a pop-up — and sent to the PDF when it is ready.
 * If the tab is blocked all the same, the PDF is downloaded.
 */
async function openSheetPdf(content: PreviewSheet): Promise<void> {
  const tab = window.open('', '_blank');
  if (!tab) {
    await saveSheetPdf(content);
    return;
  }
  const url = await sheetPdfUrl(content);
  tab.location.href = url;
  // Long enough for the tab to have loaded it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Save the sheet as a PDF, downloaded as `practice-sheet.pdf`. */
export async function saveSheetPdf(content: PreviewSheet): Promise<void> {
  const url = await sheetPdfUrl(content);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'practice-sheet.pdf';
  link.click();

  // Let the download take the file before letting it go.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
