/** Editor actions that can be triggered from the keyboard. */
export type EditorAction =
  | { readonly type: 'delete' }
  | { readonly type: 'undo' }
  | { readonly type: 'redo' }
  | { readonly type: 'duplicate' }
  | { readonly type: 'rotate'; readonly degrees: number }
  | { readonly type: 'nudge'; readonly dx: number; readonly dy: number }
  | { readonly type: 'selectAll' }
  | { readonly type: 'clearSelection' };

export interface KeyInput {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

export const NUDGE_STEP_CM = 1;
export const NUDGE_STEP_LARGE_CM = 10;
export const ROTATION_STEP_DEGREES = 90;
export const ROTATION_STEP_FINE_DEGREES = 15;

const ARROW_DIRECTIONS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Pure mapping from a key event to an editor action (Ctrl and ⌘ are treated alike). */
export function resolveShortcut(input: KeyInput): EditorAction | null {
  const modifier = input.ctrlKey || input.metaKey;
  const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;

  if (modifier) {
    if (key === 'z') return input.shiftKey ? { type: 'redo' } : { type: 'undo' };
    if (key === 'y') return { type: 'redo' };
    if (key === 'd') return { type: 'duplicate' };
    if (key === 'a') return { type: 'selectAll' };
    return null;
  }
  if (key === 'Delete' || key === 'Backspace') return { type: 'delete' };
  if (key === 'Escape') return { type: 'clearSelection' };
  if (key === 'r') {
    const step = input.altKey ? ROTATION_STEP_FINE_DEGREES : ROTATION_STEP_DEGREES;
    return { type: 'rotate', degrees: input.shiftKey ? -step : step };
  }
  const direction = ARROW_DIRECTIONS[key];
  if (direction) {
    const step = input.shiftKey ? NUDGE_STEP_LARGE_CM : NUDGE_STEP_CM;
    return { type: 'nudge', dx: direction[0] * step, dy: direction[1] * step };
  }
  return null;
}

/** Shortcuts must not fire while the user types into a form field. */
export function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}
