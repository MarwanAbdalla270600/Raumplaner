/**
 * A reversible state transition (Command pattern). Commands are pure: they never mutate
 * the given state but return a new one, which keeps undo/redo deterministic.
 */
export interface Command<TState> {
  /** i18n key describing the action, e.g. for "Undo: move furniture". */
  readonly label: string;
  apply(state: TState): TState;
  revert(state: TState): TState;
}

/** Bundles several commands into one undo step. */
export class CompositeCommand<TState> implements Command<TState> {
  constructor(
    readonly label: string,
    private readonly commands: readonly Command<TState>[],
  ) {}

  apply(state: TState): TState {
    return this.commands.reduce((current, command) => command.apply(current), state);
  }

  revert(state: TState): TState {
    return [...this.commands].reverse().reduce((current, command) => command.revert(current), state);
  }
}
