import type { FontUnitMetrics } from '../src/index.js';
import { METRIC_TOGGLES, createMetricToggle, type MetricToggle } from './button.js';
import type { LineStyles } from './line-styles.js';
import { rowInput, type RowState } from './row-input.js';

export interface RowCardOptions {
  /** 1-based, as the user counts them. */
  row: number;
  /** The metrics this row draws, edited in place. */
  state: RowState;
  /** How each line is drawn; needed to check the row's values. */
  styles: LineStyles;
  /** A value or a toggle changed; its errors are already shown. */
  onChange: () => void;
}

/**
 * One row's metrics on a card titled Row N Metrics: a toggle and a value
 * for each metric line and for the italic angle, as the row editor had
 * them. The sheet itself is the preview, so the card carries none.
 *
 * A fieldset, as the row editor is, so its frame and controls take the
 * same styles.
 */
export function createRowCard(options: RowCardOptions): HTMLElement {
  const { row, state, styles, onChange } = options;

  const card = document.createElement('fieldset');
  card.className = 'editor frame row-card';

  const title = document.createElement('h3');
  title.className = 'heading-h3 frame-title row-card-title';
  title.id = `row-card-title-${row}`;
  title.textContent = `Row ${row} Metrics`;
  card.setAttribute('aria-labelledby', title.id);

  const controls = document.createElement('div');
  controls.className = 'metric-controls';
  card.append(title, controls);

  /** Each field's toggle, keyed by the config path its errors come back on. */
  const byPath = new Map<string, MetricToggle>();

  /** Say what's wrong with each value, under its own field. */
  const check = () => {
    const errors = new Map<string, string>();
    rowInput(state, styles, errors);
    for (const [path, toggle] of byPath) toggle.setError(errors.get(path) ?? null);
  };
  const changed = () => {
    check();
    onChange();
  };

  for (const { type, name, field } of METRIC_TOGGLES) {
    const toggle = createMetricToggle({
      name,
      on: state.visible[type],
      field: { ...field, value: state.units[type as keyof FontUnitMetrics] ?? field.value },
      onToggle(on) {
        state.visible[type] = on;
        changed();
      },
      onValue(value) {
        state.units[type as keyof FontUnitMetrics] = value;
        changed();
      },
    });
    byPath.set(`metrics.${type}`, toggle);
    controls.append(toggle.element);
  }

  const italic = createMetricToggle({
    name: 'Italic angle',
    on: state.slant.enabled,
    field: { value: state.slant.angle ?? 30, unit: 'Deg' },
    onToggle(on) {
      state.slant.enabled = on;
      changed();
    },
    onValue(value) {
      state.slant.angle = value;
      changed();
    },
  });
  byPath.set('slant.angle', italic);
  controls.append(italic.element);

  check();
  return card;
}
