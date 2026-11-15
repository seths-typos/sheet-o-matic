export { buildSheet } from './sheet.js';
export { LayoutError } from './errors.js';
export {
  bandExtremes,
  fitRowCount,
  metricHeightRatio,
  metricOffsets,
  rowPitch,
  solveCapHeight,
  totalMetricHeight,
} from './metrics.js';
export { slantLines } from './slant.js';
export { buildRows, type RowLayout } from './rows.js';
export type {
  HeaderBlock,
  LineSegment,
  LineType,
  MetricLine,
  Point,
  Rect,
  Row,
  Sheet,
} from './types.js';
