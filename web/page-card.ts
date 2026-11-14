import { createHeaderFields, type HeaderText } from './header-panel.js';
import {
  createMarginField,
  createOrientationToggle,
  createPaperToggle,
  createValuesToggle,
} from './page-setup.js';
import type { PageSetup } from './sheet-preview.js';

export interface PageCardOptions {
  /** The paper the sheet prints on, edited in place. */
  page: PageSetup;
  /** The text across the top of the page, edited in place. */
  header: HeaderText;
  /** The orientation or the paper changed: the sheet has a new shape. */
  onReshape: () => void;
  /** Anything else changed. */
  onChange: () => void;
}

/**
 * The page on a card titled Page Setup: its orientation, paper, margin and
 * whether metric values are shown, then the header's three texts. Framed
 * as a row's metrics card is, a fieldset so it takes the same styles.
 */
export function createPageCard(options: PageCardOptions): HTMLElement {
  const { page, header, onReshape, onChange } = options;

  const card = document.createElement('fieldset');
  card.className = 'editor frame side-card page-card';

  const title = document.createElement('h3');
  title.className = 'heading-h3 frame-title';
  title.id = 'page-card-title';
  title.textContent = 'Page Setup';
  card.setAttribute('aria-labelledby', title.id);

  const controls = document.createElement('div');
  controls.className = 'side-card-controls';
  controls.append(
    createOrientationToggle(page, onReshape),
    createPaperToggle(page, onReshape),
    createMarginField(page, onChange),
    createValuesToggle(page, onChange),
  );

  // The header's texts, under a heading in the card title's face and a
  // line saying what they are for.
  const headerName = document.createElement('h4');
  headerName.className = 'heading-h3 side-card-heading';
  headerName.id = 'page-card-header';
  headerName.textContent = 'Header Text';
  const info = document.createElement('p');
  info.className = 'body-sm side-card-info';
  info.id = 'page-card-header-info';
  info.textContent = 'Optional text, printed across the top of the page.';
  const fields = createHeaderFields(header, onChange);
  fields.setAttribute('role', 'group');
  fields.setAttribute('aria-labelledby', headerName.id);
  fields.setAttribute('aria-describedby', info.id);
  const headerText = document.createElement('div');
  headerText.className = 'sheet-control page-card-header';
  headerText.append(headerName, info, fields);

  card.append(title, controls, headerText);
  return card;
}
