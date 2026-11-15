import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../../src/index.js';
import { defaultLineStyles } from '../line-styles.js';
import { newRowState, rowInput } from '../row-input.js';

const check = (change: (state: ReturnType<typeof newRowState>) => void) => {
  const state = newRowState();
  change(state);
  const errors = new Map<string, string>();
  const input = rowInput(state, defaultLineStyles(), errors);
  return { input, errors };
};

describe('a metric switched off', () => {
  it('is not asked for a number', () => {
    const { input, errors } = check((state) => {
      state.units.ascender = null;
      state.visible.ascender = false;
    });

    expect(errors.size).toBe(0);
    expect(input).not.toBeNull();
  });

  it('is not held to its side of the baseline', () => {
    const { input, errors } = check((state) => {
      state.units.descender = 100;
      state.visible.descender = false;
      state.units.xHeight = -5;
      state.visible.xHeight = false;
    });

    expect(errors.size).toBe(0);
    expect(input).not.toBeNull();
  });

  it('stands in a value that sizes nothing when its own is no good', () => {
    const { input } = check((state) => {
      state.units.ascender = null;
      state.visible.ascender = false;
      state.units.descender = 100;
      state.visible.descender = false;
    });

    // The ascender on the cap height, the descender on the baseline.
    expect(input!.metrics!.ascender).toBeCloseTo(100, 10);
    expect(input!.metrics!.descender).toBeCloseTo(0, 10);
  });

  it('keeps a good value, and so the row its size', () => {
    const drawn = check(() => {}).input!;
    const hidden = check((state) => {
      state.visible.ascender = false;
      state.visible.descender = false;
    }).input!;

    expect(hidden.metrics).toEqual(drawn.metrics);
    expect(resolveConfig(hidden).metrics.ascender).toBeCloseTo((800 / 700) * 100, 10);
  });
});

describe('a metric switched on', () => {
  it('is still asked for a number', () => {
    const { input, errors } = check((state) => {
      state.units.ascender = null;
    });

    expect(errors.get('metrics.ascender')).toBe('Enter a number.');
    expect(input).toBeNull();
  });

  it('needs the cap height whether or not its line is drawn', () => {
    const { input, errors } = check((state) => {
      state.units.capHeight = null;
      state.visible.capHeight = false;
    });

    expect(errors.get('metrics.capHeight')).toBe('Enter a number.');
    expect(input).toBeNull();
  });
});
