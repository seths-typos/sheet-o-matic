import { createChoiceToggle } from './sheet-controls.js';
import type { PageSetup } from './sheet-preview.js';

// Page Setup's controls: the paper the sheet prints on — its orientation,
// its size and its margin — and whether each metric line's value is
// printed beside it. Each edits `page` in place, calling `onChange` after.

/** Show metric values: each line's value printed beside it, or not. */
export function createValuesToggle(page: PageSetup, onChange: () => void = () => {}): HTMLElement {
  return createChoiceToggle(
    'Show metric values',
    [
      { value: 'on', label: 'On' },
      { value: 'off', label: 'Off' },
    ],
    page.values ? 'on' : 'off',
    (shown) => {
      page.values = shown === 'on';
      onChange();
    },
  );
}

/** Orientation: landscape or portrait. */
export function createOrientationToggle(page: PageSetup, onChange: () => void = () => {}): HTMLElement {
  return createChoiceToggle(
    'Orientation',
    [
      { value: 'landscape', label: 'Landscape' },
      { value: 'portrait', label: 'Portrait' },
    ],
    page.orientation,
    (orientation) => {
      page.orientation = orientation;
      onChange();
    },
  );
}

/** Paper: Letter or A4. */
export function createPaperToggle(page: PageSetup, onChange: () => void = () => {}): HTMLElement {
  return createChoiceToggle(
    'Paper',
    [
      { value: 'letter', label: 'Letter' },
      { value: 'a4', label: 'A4' },
    ],
    page.size,
    (size) => {
      page.size = size;
      onChange();
    },
  );
}

let nextId = 0;

/**
 * Margins: one value in points for all four sides, a whole number of at
 * least 0. A value that isn't one is marked and left out, the last good
 * one standing.
 */
export function createMarginField(page: PageSetup, onChange: () => void = () => {}): HTMLElement {
  const id = `page-margin-${nextId++}`;

  const control = document.createElement('div');
  control.className = 'sheet-control page-setup-margin';

  const label = document.createElement('label');
  label.className = 'ui-sm sheet-control-name';
  label.htmlFor = id;
  label.textContent = 'Margins';

  const input = document.createElement('input');
  input.className = 'body-md page-setup-margin-input';
  input.id = id;
  input.type = 'number';
  input.inputMode = 'numeric';
  input.min = '0';
  input.step = '1';
  input.value = String(page.margin);
  input.addEventListener('input', () => {
    const value = Number(input.value);
    const valid = input.value.trim() !== '' && Number.isFinite(value) && value >= 0;
    input.setAttribute('aria-invalid', String(!valid));
    if (!valid) return;
    page.margin = value;
    onChange();
  });

  const unit = document.createElement('span');
  unit.className = 'ui-sm page-setup-margin-unit';
  unit.textContent = 'pt';

  const field = document.createElement('div');
  field.className = 'page-setup-margin-field';
  field.append(input, unit);

  control.append(label, field);
  return control;
}
