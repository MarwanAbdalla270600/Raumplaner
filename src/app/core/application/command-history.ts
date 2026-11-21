import { Command } from './command';

export const DEFAULT_HISTORY_LIMIT = 200;

/** Immutable undo/redo stacks. */
export interface CommandHistory<TState> {
  readonly past: readonly Command<TState>[];
  readonly future: readonly Command<TState>[];
}

export interface HistoryTransition<TState> {
  readonly state: TState;
  readonly history: CommandHistory<TState>;
}

export function emptyHistory<TState>(): CommandHistory<TState> {
  return { past: [], future: [] };
}

export function executeCommand<TState>(
  state: TState,
  history: CommandHistory<TState>,
  command: Command<TState>,
  limit = DEFAULT_HISTORY_LIMIT,
): HistoryTransition<TState> {
  const past = [...history.past, command].slice(-limit);
  return { state: command.apply(state), history: { past, future: [] } };
}

export function undoCommand<TState>(state: TState, history: CommandHistory<TState>): HistoryTransition<TState> {
  const command = history.past.at(-1);
  if (!command) {
    return { state, history };
  }
  return {
    state: command.revert(state),
    history: { past: history.past.slice(0, -1), future: [command, ...history.future] },
  };
}

export function redoCommand<TState>(state: TState, history: CommandHistory<TState>): HistoryTransition<TState> {
  const [command, ...future] = history.future;
  if (!command) {
    return { state, history };
  }
  return { state: command.apply(state), history: { past: [...history.past, command], future } };
}

export function canUndo(history: CommandHistory<unknown>): boolean {
  return history.past.length > 0;
}

export function canRedo(history: CommandHistory<unknown>): boolean {
  return history.future.length > 0;
}
