/**
 * Header: optional text set across the top of the printed page — on the
 * left, in the centre and on the right. A text field for each place.
 */

export interface HeaderText {
  left: string;
  center: string;
  right: string;
}

export function emptyHeaderText(): HeaderText {
  return { left: '', center: '', right: '' };
}

const PLACES: { key: keyof HeaderText; name: string }[] = [
  { key: 'left', name: 'Left' },
  { key: 'center', name: 'Center' },
  { key: 'right', name: 'Right' },
];

let nextId = 0;

/**
 * The three fields alone, without the panel round them: a name and a text
 * field for each place. Edits `text` in place, calling `onChange` after
 * each edit.
 */
export function createHeaderFields(text: HeaderText, onChange: () => void = () => {}): HTMLElement {
  const fields = document.createElement('div');
  fields.className = 'header-fields';

  for (const { key, name } of PLACES) {
    const id = `header-${key}-${nextId++}`;

    const label = document.createElement('label');
    label.className = 'ui-sm header-field-name';
    label.htmlFor = id;
    label.textContent = name;

    const input = document.createElement('input');
    input.className = 'body-md header-field-input';
    input.type = 'text';
    input.id = id;
    input.value = text[key];
    input.autocomplete = 'off';
    input.addEventListener('input', () => {
      text[key] = input.value;
      onChange();
    });

    // The rule that draws across under the field while it has focus.
    const border = document.createElement('span');
    border.className = 'header-field-border';
    border.setAttribute('aria-hidden', 'true');

    const field = document.createElement('div');
    field.className = 'header-field';
    field.append(input, border);

    fields.append(label, field);
  }

  return fields;
}
