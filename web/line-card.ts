import {
  LINE_COLORS,
  STYLED_LINES,
  type LineStyles,
  type LineWeight,
  type StyledLine,
} from './line-styles.js';
import { createChoiceToggle, createStepToggle } from './sheet-controls.js';

export interface LineCardOptions {
  /** How each line is drawn, shared by every row. Edited in place. */
  styles: LineStyles;
  /** A line's style changed. */
  onChange: () => void;
}

const WEIGHTS: { value: `${LineWeight}`; label: string }[] = [
  { value: '1', label: 'Thin' },
  { value: '2', label: 'Medium' },
  { value: '3', label: 'Thick' },
];

/** The line last picked, so the card opens on it again. */
let picked: StyledLine = STYLED_LINES[0]!.type;

let nextId = 0;

/**
 * The lines' styles on a card titled Line Styles: a Metric Line menu to
 * pick a line, then that line's weight, style and colour, each option
 * worded. Framed as the other cards are, a fieldset so it takes the same
 * styles.
 */
export function createLineCard(options: LineCardOptions): HTMLElement {
  const { styles, onChange } = options;
  const id = `line-card-${nextId++}`;

  const card = document.createElement('fieldset');
  card.className = 'editor frame side-card line-card';

  const title = document.createElement('h3');
  title.className = 'heading-h3 frame-title';
  title.id = `${id}-title`;
  title.textContent = 'Line Styles';
  card.setAttribute('aria-labelledby', title.id);

  // Which line: a menu, named as the controls under it are.
  const lineName = document.createElement('label');
  lineName.className = 'ui-sm sheet-control-name';
  lineName.htmlFor = `${id}-line`;
  lineName.textContent = 'Metric line';
  const select = document.createElement('select');
  select.className = 'ui-sm line-select-input';
  select.id = `${id}-line`;
  for (const { type, name } of STYLED_LINES) {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = name;
    option.selected = type === picked;
    select.append(option);
  }
  const selectBox = document.createElement('div');
  selectBox.className = 'line-select';
  selectBox.append(select);
  const line = document.createElement('div');
  line.className = 'sheet-control';
  line.append(lineName, selectBox);

  // The picked line's style, built again for each line picked.
  const controls = document.createElement('div');
  controls.className = 'side-card-controls';
  const show = () => {
    const choice = styles[picked];
    controls.replaceChildren(
      createStepToggle('Weight', WEIGHTS, `${choice.weight}`, (value) => {
        choice.weight = Number(value) as LineWeight;
        onChange();
      }),
      createChoiceToggle(
        'Style',
        [
          { value: 'solid', label: 'Solid' },
          { value: 'dashed', label: 'Dashed' },
        ],
        choice.dashed ? 'dashed' : 'solid',
        (value) => {
          choice.dashed = value === 'dashed';
          onChange();
        },
      ),
      createStepToggle(
        'Color',
        LINE_COLORS.map(({ value, name }) => ({ value, label: name })),
        choice.color,
        (value) => {
          choice.color = value;
          onChange();
        },
      ),
    );
  };
  select.addEventListener('change', () => {
    picked = select.value as StyledLine;
    show();
  });
  show();

  card.append(title, line, controls);
  return card;
}
