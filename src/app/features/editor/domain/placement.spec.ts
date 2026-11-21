import { vec } from '../../../core/domain/geometry';
import { floor, furniture, room } from '../../../testing/fixtures';
import { findFreePosition } from './placement';

describe('findFreePosition', () => {
  it('keeps the preferred position when it is free', () => {
    expect(findFreePosition(floor(), furniture(), vec(100, 100))).toEqual(vec(100, 100));
  });

  it('moves the item next to an occupied spot', () => {
    const occupied = floor({ furniture: [furniture({ id: 'a', x: 100, y: 100, width: 100, depth: 50 })] });
    const position = findFreePosition(occupied, furniture({ id: 'b', width: 100, depth: 50 }), vec(100, 100), 10);
    expect(position).not.toEqual(vec(100, 100));
    // The closest free spot is directly above or below (depth 50).
    expect(Math.abs(position.y - 100)).toBe(50);
    expect(position.x).toBe(100);
  });

  it('keeps new items out of walls', () => {
    const withRoom = floor({ rooms: [room({ x: 0, y: 0, width: 400, depth: 300, wallThickness: 10 })] });
    const position = findFreePosition(withRoom, furniture({ width: 100, depth: 50 }), vec(400, 150), 10);
    expect(position.x + 50).toBeLessThanOrEqual(400);
  });
});
