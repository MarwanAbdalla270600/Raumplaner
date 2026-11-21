import { aabb } from '../../../core/domain/geometry';
import { snapAngle, snapAxis, snapBounds, snapToGrid } from './snapping';

describe('snapping', () => {
  it('snaps values to the grid', () => {
    expect(snapToGrid(14, 10)).toBe(10);
    expect(snapToGrid(15, 10)).toBe(20);
    expect(snapToGrid(-6, 10)).toBe(-10);
    expect(snapToGrid(7, 0)).toBe(7);
  });

  it('finds the closest target within the threshold', () => {
    expect(snapAxis([100, 150], [104, 160], 5)).toEqual({ correction: 4, target: 104 });
    expect(snapAxis([100], [120], 5)).toEqual({ correction: 0, target: null });
  });

  it('prefers object edges over the grid', () => {
    const result = snapBounds(aabb(97, 33, 147, 83), { xs: [100], ys: [] }, 5, 10);
    expect(result.delta.x).toBe(3);
    expect(result.guideX).toBe(100);
    // y falls back to the grid: 33 → 30
    expect(result.delta.y).toBe(-3);
    expect(result.guideY).toBeNull();
  });

  it('snaps angles to steps', () => {
    expect(snapAngle(44, 15)).toBe(45);
    expect(snapAngle(100, 90)).toBe(90);
  });
});
