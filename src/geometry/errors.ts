/**
 * The rows don't fit the page: the margins, header and row gaps leave them
 * no height or width. A valid config can still ask for this — each value is
 * in range, but together they leave no room — so it is told apart from a
 * mistake in the code.
 */
export class LayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LayoutError';
  }
}
