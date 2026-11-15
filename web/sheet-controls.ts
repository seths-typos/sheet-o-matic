/**
 * Controls for the sheet as a whole, set above the rows: how many rows it
 * has, and whether they share their metrics.
 */

let nextId = 0;

export const MIN_ROWS = 1;
export const MAX_ROWS = 6;

/** How a control is named. */
export interface ControlOptions {
  /** Name it for screen readers only, where its place already says it. */
  hideName?: boolean;
}

/**
 * "Number of rows": a tab for each count, 1 to 6, the thumb under the
 * chosen one.
 */
export function createRowCountTabs(
  value: number,
  onChange: (count: number) => void,
): HTMLElement {
  const counts = Array.from({ length: MAX_ROWS - MIN_ROWS + 1 }, (_, i) => String(MIN_ROWS + i));
  const control = createStepToggle(
    'Number of rows',
    counts.map((count) => ({ value: count, label: count })),
    String(value),
    (count) => onChange(Number(count)),
  );
  control.classList.add('count-toggle');
  return control;
}

export interface Choice<T extends string> {
  value: T;
  label: string;
}

/**
 * A two-way switch in the toggles' style: a white shell with its bottom-left
 * and top-right corners cut, the chosen option white and the other red.
 * Radio buttons underneath, so arrow keys move between the options.
 */
export function createChoiceToggle<T extends string>(
  name: string,
  choices: Choice<T>[],
  value: T,
  onChange: (value: T) => void,
  options: ControlOptions = {},
): HTMLElement {
  const id = `sheet-control-${nextId++}`;

  const control = document.createElement('div');
  control.className = 'sheet-control';
  control.setAttribute('role', 'radiogroup');
  control.setAttribute('aria-labelledby', id);

  const label = document.createElement('span');
  label.className = nameClass(options);
  label.id = id;
  label.textContent = name;

  const shell = document.createElement('div');
  shell.className = 'choice';

  for (const choice of choices) {
    const option = document.createElement('label');
    option.className = 'choice-option';
    // Read by the stylesheet to hold the width of the label at its hover
    // weight.
    option.dataset.label = choice.label;

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = id;
    radio.value = choice.value;
    radio.checked = choice.value === value;
    radio.addEventListener('change', () => {
      if (radio.checked) onChange(choice.value);
    });

    const text = document.createElement('span');
    text.textContent = choice.label;

    option.append(radio, text);
    shell.append(option);
  }

  control.append(label, shell);
  return control;
}

/** A control's name: shown above it, or kept for screen readers only. */
export function nameClass(options: ControlOptions): string {
  return options.hideName ? 'visually-hidden' : 'ui-sm sheet-control-name';
}

/**
 * A choice toggle of any number of options: the thumb as wide as one, and
 * stepping one at a time. The plain toggle's thumb is a half, for two.
 */
export function createStepToggle<T extends string>(
  name: string,
  choices: Choice<T>[],
  value: T,
  onChange: (value: T) => void,
  options: ControlOptions = {},
): HTMLElement {
  const values = choices.map((choice) => choice.value);
  const control = createChoiceToggle(
    name,
    choices,
    value,
    (chosen) => {
      place(chosen);
      onChange(chosen);
    },
    options,
  );
  control.classList.add('step-toggle');
  // Read by the stylesheet: how many options share the shell, and which
  // the thumb sits under.
  const shell = control.querySelector<HTMLElement>('.choice')!;
  shell.style.setProperty('--options', String(values.length));
  const place = (chosen: T) => shell.style.setProperty('--chosen', String(values.indexOf(chosen)));
  place(value);
  return control;
}
