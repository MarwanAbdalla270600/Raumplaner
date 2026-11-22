import { vec } from '../../../core/domain/geometry';
import { room } from '../../../testing/fixtures';
import { roomOrigin, translateRoom } from '../../project/domain/room-geometry';
import { snapRoomTranslation, snapVertex } from './room-snapping';

describe('room snapping', () => {
  const left = room({ id: 'a', x: 0, y: 0, width: 400, depth: 300, wallThickness: 12 });
  const right = room({ id: 'b', x: 0, y: 0, width: 300, depth: 300, wallThickness: 12 });

  it('glues a dragged room to the outer face of a neighbouring wall (shared wall)', () => {
    // Dropped 6 cm too far right and 4 cm too low.
    const result = snapRoomTranslation(right, vec(418, 4), [left], 10, 10);
    const moved = translateRoom(right, result.delta);
    expect(roomOrigin(moved)).toEqual({ x: 412, y: 0 });
    expect(result.glued).toHaveLength(1);
  });

  it('falls back to the grid when no wall is near', () => {
    const result = snapRoomTranslation(right, vec(1003, 17), [left], 10, 10);
    expect(result).toEqual({ delta: vec(1000, 20), glued: [] });
  });

  it('glues into a corner between two rooms', () => {
    const below = room({ id: 'c', x: 0, y: 312, width: 400, depth: 200, wallThickness: 12 });
    const small = room({ id: 'd', x: 0, y: 0, width: 200, depth: 200, wallThickness: 12 });
    const result = snapRoomTranslation(small, vec(415, 318), [left, below], 10, 10);
    expect(roomOrigin(translateRoom(small, result.delta))).toEqual({ x: 412, y: 312 });
  });

  it('snaps corners to outer corners and wall faces of other rooms', () => {
    const context = { others: [left], neighbours: [], threshold: 10, gridSize: 10 };
    expect(snapVertex(vec(415, -8), context).point).toEqual({ x: 412, y: -12 });
    const onWall = snapVertex(vec(409, 150), context);
    expect(onWall.point.x).toBeCloseTo(412);
    expect(onWall.guide).not.toBeNull();
    expect(snapVertex(vec(803, 497), context).point).toEqual({ x: 800, y: 500 });
  });

  it('aligns corners horizontally and vertically with their neighbours', () => {
    const context = { others: [], neighbours: [vec(100, 100)], threshold: 10, gridSize: null };
    expect(snapVertex(vec(305, 104), context).point).toEqual({ x: 305, y: 100 });
  });

  it('glues rooms without wall thickness edge to edge', () => {
    const a = room({ id: 'a', x: 0, y: 0, width: 400, depth: 300, wallThickness: 0 });
    const b = room({ id: 'b', x: 0, y: 0, width: 300, depth: 300, wallThickness: 0 });
    const result = snapRoomTranslation(b, vec(405, 3), [a], 10, 10);
    expect(roomOrigin(translateRoom(b, result.delta))).toEqual({ x: 400, y: 0 });
  });
});
