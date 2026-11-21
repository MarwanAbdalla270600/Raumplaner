import { floor, furniture, project } from '../../../../testing/fixtures';
import { AddFurnitureCommand, RemoveFurnitureCommand, UpdateFurnitureCommand } from './furniture-commands';

describe('furniture commands', () => {
  const a = furniture({ id: 'a' });
  const b = furniture({ id: 'b' });
  const c = furniture({ id: 'c' });
  const base = project({ floors: [floor({ furniture: [a, b, c] })] });

  it('adds and reverts', () => {
    const d = furniture({ id: 'd' });
    const command = new AddFurnitureCommand('floor-1', [d]);
    const applied = command.apply(base);
    expect(applied.floors[0].furniture.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(command.revert(applied)).toEqual(base);
  });

  it('restores removed items at their original position', () => {
    const command = new RemoveFurnitureCommand(base, 'floor-1', new Set(['a', 'c']));
    const applied = command.apply(base);
    expect(applied.floors[0].furniture.map((i) => i.id)).toEqual(['b']);
    expect(command.revert(applied).floors[0].furniture.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('updates and reverts properties', () => {
    const moved = { ...b, x: 300 };
    const command = new UpdateFurnitureCommand('floor-1', [b], [moved]);
    const applied = command.apply(base);
    expect(applied.floors[0].furniture[1].x).toBe(300);
    expect(command.revert(applied)).toEqual(base);
  });

  it('never mutates the input project', () => {
    const snapshot = JSON.stringify(base);
    new UpdateFurnitureCommand('floor-1', [a], [{ ...a, x: 99 }]).apply(base);
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});
