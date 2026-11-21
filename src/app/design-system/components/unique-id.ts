let counter = 0;

/** Stable unique ids for label/aria associations. */
export function uniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
