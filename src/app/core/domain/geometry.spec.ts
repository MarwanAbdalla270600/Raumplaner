import {
  aabb,
  aabbFromPoints,
  aabbIntersects,
  convexPolygonsIntersect,
  normalizeAngle,
  rectCorners,
  rotatePoint,
  vec,
} from './geometry';

describe('geometry', () => {
  it('normalizes angles into [0, 360)', () => {
    expect(normalizeAngle(370)).toBe(10);
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(360)).toBe(0);
  });

  it('rotates points around an origin', () => {
    const rotated = rotatePoint(vec(10, 0), 90, vec(0, 0));
    expect(rotated.x).toBeCloseTo(0);
    expect(rotated.y).toBeCloseTo(10);
  });

  it('computes the AABB of a rotated rectangle', () => {
    const box = aabbFromPoints(rectCorners(vec(0, 0), 100, 50, 90));
    expect(box.maxX - box.minX).toBeCloseTo(50);
    expect(box.maxY - box.minY).toBeCloseTo(100);
  });

  it('treats touching boxes as not intersecting', () => {
    expect(aabbIntersects(aabb(0, 0, 10, 10), aabb(10, 0, 20, 10))).toBe(false);
    expect(aabbIntersects(aabb(0, 0, 10, 10), aabb(9, 0, 20, 10))).toBe(true);
  });

  it('detects rotated rectangle overlap with SAT', () => {
    const a = rectCorners(vec(0, 0), 100, 10, 45);
    const b = rectCorners(vec(0, 0), 100, 10, -45);
    expect(convexPolygonsIntersect(a, b)).toBe(true);
  });

  it('separates rotated rectangles whose AABBs overlap but shapes do not', () => {
    // Two thin diagonal bars side by side: AABBs overlap, polygons do not.
    const a = rectCorners(vec(0, 0), 100, 4, 45);
    const b = rectCorners(vec(20, -20), 100, 4, 45);
    expect(aabbIntersects(aabbFromPoints(a), aabbFromPoints(b))).toBe(true);
    expect(convexPolygonsIntersect(a, b)).toBe(false);
  });
});
