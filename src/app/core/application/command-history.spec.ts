import { Command, CompositeCommand } from './command';
import { canRedo, canUndo, emptyHistory, executeCommand, redoCommand, undoCommand } from './command-history';

const add = (amount: number): Command<number> => ({
  label: `add ${amount}`,
  apply: (state) => state + amount,
  revert: (state) => state - amount,
});

describe('command history', () => {
  it('executes, undoes and redoes commands', () => {
    let { state, history } = executeCommand(0, emptyHistory<number>(), add(5));
    ({ state, history } = executeCommand(state, history, add(2)));
    expect(state).toBe(7);

    ({ state, history } = undoCommand(state, history));
    expect(state).toBe(5);
    expect(canRedo(history)).toBe(true);

    ({ state, history } = redoCommand(state, history));
    expect(state).toBe(7);
    expect(canRedo(history)).toBe(false);
  });

  it('clears the redo stack when a new command is executed', () => {
    let { state, history } = executeCommand(0, emptyHistory<number>(), add(1));
    ({ state, history } = undoCommand(state, history));
    ({ state, history } = executeCommand(state, history, add(3)));
    expect(state).toBe(3);
    expect(canRedo(history)).toBe(false);
  });

  it('respects the history limit', () => {
    let transition = { state: 0, history: emptyHistory<number>() };
    for (let i = 0; i < 5; i++) {
      transition = executeCommand(transition.state, transition.history, add(1), 3);
    }
    expect(transition.history.past.length).toBe(3);
  });

  it('is a no-op when nothing can be undone', () => {
    const history = emptyHistory<number>();
    expect(canUndo(history)).toBe(false);
    expect(undoCommand(4, history).state).toBe(4);
  });

  it('reverts composite commands in reverse order', () => {
    const double: Command<number> = { label: 'double', apply: (s) => s * 2, revert: (s) => s / 2 };
    const composite = new CompositeCommand('combo', [add(1), double]);
    expect(composite.apply(1)).toBe(4);
    expect(composite.revert(4)).toBe(1);
  });
});
