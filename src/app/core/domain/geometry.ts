/** Basic 2D geometry used throughout the planner. All lengths are centimetres. */

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** Axis-aligned bounding box. */
export interface Aabb {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export type Polygon = readonly Vec2[];

const FULL_TURN_DEGREES = 360;
const HALF_TURN_DEGREES = 180;
/** Tolerance so that touching edges are not reported as overlapping. */
export const GEOMETRY_EPSILON = 1e-6;

export function vec(x: number, y: number): Vec2 {
  return { x, y };
}

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / HALF_TURN_DEGREES;
}

export function normalizeAngle(degrees: number): number {
  const normalized = degrees % FULL_TURN_DEGREES;
  return normalized < 0 ? normalized + FULL_TURN_DEGREES : normalized;
}

export function rotatePoint(point: Vec2, degrees: number, origin: Vec2 = vec(0, 0)): Vec2 {
  const radians = degToRad(degrees);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return vec(origin.x + dx * cos - dy * sin, origin.y + dx * sin + dy * cos);
}

/** Corners of a (possibly rotated) rectangle given by its centre. Clockwise from top-left. */
export function rectCorners(center: Vec2, width: number, depth: number, rotation: number): Polygon {
  const halfW = width / 2;
  const halfD = depth / 2;
  const local = [vec(-halfW, -halfD), vec(halfW, -halfD), vec(halfW, halfD), vec(-halfW, halfD)];
  return local.map((corner) => rotatePoint(vec(center.x + corner.x, center.y + corner.y), rotation, center));
}

export function aabb(minX: number, minY: number, maxX: number, maxY: number): Aabb {
  return { minX, minY, maxX, maxY };
}

export function aabbFromRect(x: number, y: number, width: number, height: number): Aabb {
  return aabb(x, y, x + width, y + height);
}

export function aabbFromPoints(points: Polygon): Aabb {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return aabb(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
}

export function aabbFromCorners(a: Vec2, b: Vec2): Aabb {
  return aabb(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y));
}

export function aabbToPolygon(box: Aabb): Polygon {
  return [vec(box.minX, box.minY), vec(box.maxX, box.minY), vec(box.maxX, box.maxY), vec(box.minX, box.maxY)];
}

export function aabbWidth(box: Aabb): number {
  return box.maxX - box.minX;
}

export function aabbHeight(box: Aabb): number {
  return box.maxY - box.minY;
}

export function aabbCenter(box: Aabb): Vec2 {
  return vec((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2);
}

export function expandAabb(box: Aabb, amount: number): Aabb {
  return aabb(box.minX - amount, box.minY - amount, box.maxX + amount, box.maxY + amount);
}

export function translateAabb(box: Aabb, delta: Vec2): Aabb {
  return aabb(box.minX + delta.x, box.minY + delta.y, box.maxX + delta.x, box.maxY + delta.y);
}

export function unionAabb(boxes: readonly Aabb[]): Aabb | null {
  if (boxes.length === 0) {
    return null;
  }
  return aabb(
    Math.min(...boxes.map((b) => b.minX)),
    Math.min(...boxes.map((b) => b.minY)),
    Math.max(...boxes.map((b) => b.maxX)),
    Math.max(...boxes.map((b) => b.maxY)),
  );
}

/** Strict overlap: boxes that only touch do not intersect. */
export function aabbIntersects(a: Aabb, b: Aabb): boolean {
  return (
    a.minX < b.maxX - GEOMETRY_EPSILON &&
    b.minX < a.maxX - GEOMETRY_EPSILON &&
    a.minY < b.maxY - GEOMETRY_EPSILON &&
    b.minY < a.maxY - GEOMETRY_EPSILON
  );
}

export function aabbContainsPoint(box: Aabb, point: Vec2): boolean {
  return point.x >= box.minX && point.x <= box.maxX && point.y >= box.minY && point.y <= box.maxY;
}

export function aabbContainsAabb(outer: Aabb, inner: Aabb): boolean {
  return inner.minX >= outer.minX && inner.maxX <= outer.maxX && inner.minY >= outer.minY && inner.maxY <= outer.maxY;
}

function edgeNormals(polygon: Polygon): Vec2[] {
  return polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return vec(-(next.y - point.y), next.x - point.x);
  });
}

function project(polygon: Polygon, axis: Vec2): { min: number; max: number } {
  const values = polygon.map((p) => p.x * axis.x + p.y * axis.y);
  return { min: Math.min(...values), max: Math.max(...values) };
}

/**
 * Separating Axis Theorem for convex polygons. Returns true only for a real overlap
 * (positive penetration depth), touching polygons are considered separate.
 */
export function convexPolygonsIntersect(a: Polygon, b: Polygon): boolean {
  const axes = [...edgeNormals(a), ...edgeNormals(b)];
  return axes.every((axis) => {
    const length = Math.hypot(axis.x, axis.y);
    if (length === 0) {
      return true;
    }
    const unit = vec(axis.x / length, axis.y / length);
    const pa = project(a, unit);
    const pb = project(b, unit);
    return pa.max - pb.min > GEOMETRY_EPSILON && pb.max - pa.min > GEOMETRY_EPSILON;
  });
}

/** Do the closed intervals [aMin, aMax) and [bMin, bMax) overlap with positive length? */
export function intervalsOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMin < bMax - GEOMETRY_EPSILON && bMin < aMax - GEOMETRY_EPSILON;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
