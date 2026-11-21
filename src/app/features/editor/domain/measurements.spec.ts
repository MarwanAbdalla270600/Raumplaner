import { aabb } from '../../../core/domain/geometry';
import { computeClearances } from './measurements';

describe('clearances', () => {
  it('measures the free distance to the nearest obstacle in each direction', () => {
    const box = aabb(100, 100, 200, 150);
    const obstacles = [aabb(0, 0, 10, 300), aabb(50, 0, 60, 300), aabb(250, 120, 300, 130), aabb(0, 400, 500, 410)];
    const clearances = Object.fromEntries(computeClearances(box, obstacles).map((c) => [c.direction, c.distance]));
    expect(clearances).toEqual({ left: 40, right: 50, down: 250 });
  });

  it('ignores obstacles that are not in line with the box', () => {
    const clearances = computeClearances(aabb(0, 0, 10, 10), [aabb(20, 20, 30, 30)]);
    expect(clearances).toEqual([]);
  });

  it('provides dimension line coordinates', () => {
    const [left] = computeClearances(aabb(100, 100, 200, 150), [aabb(0, 0, 60, 300)]);
    expect(left.from).toEqual({ x: 60, y: 125 });
    expect(left.to).toEqual({ x: 100, y: 125 });
  });
});
