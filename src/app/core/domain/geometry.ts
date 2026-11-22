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

// ── Vector helpers ─────────────────────────────────────────────────────────

export function addVec(a: Vec2, b: Vec2, factor = 1): Vec2 {
  return vec(a.x + b.x * factor, a.y + b.y * factor);
}

export function subVec(a: Vec2, b: Vec2): Vec2 {
  return vec(a.x - b.x, a.y - b.y);
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

export function length(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

export function distanceBetween(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normalize(v: Vec2): Vec2 {
  const len = length(v);
  return len === 0 ? vec(0, 0) : vec(v.x / len, v.y / len);
}

export function lerpVec(a: Vec2, b: Vec2, t: number): Vec2 {
  return vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
}

// ── Polygons ───────────────────────────────────────────────────────────────

/**
 * Shoelace area. Positive for polygons that run clockwise on screen (y axis pointing down),
 * e.g. top-left → top-right → bottom-right → bottom-left.
 */
export function polygonSignedArea(points: Polygon): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function polygonArea(points: Polygon): number {
  return Math.abs(polygonSignedArea(points));
}

/** Returns the polygon in screen-clockwise order (positive signed area). */
export function ensureClockwise(points: Polygon): Vec2[] {
  return polygonSignedArea(points) < 0 ? [...points].reverse() : [...points];
}

export function translatePolygon(points: Polygon, delta: Vec2): Vec2[] {
  return points.map((point) => addVec(point, delta));
}

export function polygonCentroid(points: Polygon): Vec2 {
  const area = polygonSignedArea(points);
  if (Math.abs(area) < GEOMETRY_EPSILON) {
    const sum = points.reduce((acc, p) => addVec(acc, p), vec(0, 0));
    return vec(sum.x / points.length, sum.y / points.length);
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const f = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * f;
    cy += (a.y + b.y) * f;
  }
  return vec(cx / (6 * area), cy / (6 * area));
}

/** Even-odd point-in-polygon test (works for concave polygons). */
export function pointInPolygon(point: Vec2, polygon: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = a.y > point.y !== b.y > point.y;
    if (crosses && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * A point that is guaranteed to lie inside the polygon (for labels): the centroid when it is
 * inside, otherwise the middle of the widest horizontal span through the centroid.
 */
export function polygonLabelPoint(polygon: Polygon): Vec2 {
  const centroid = polygonCentroid(polygon);
  if (pointInPolygon(centroid, polygon)) {
    return centroid;
  }
  const bounds = aabbFromPoints(polygon);
  let best: Vec2 = centroid;
  let bestWidth = -1;
  const samples = 9;
  for (let s = 1; s <= samples; s++) {
    const y = bounds.minY + ((bounds.maxY - bounds.minY) * s) / (samples + 1);
    const xs: number[] = [];
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i];
      const b = polygon[j];
      if (a.y > y !== b.y > y) xs.push(((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x);
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const width = xs[k + 1] - xs[k];
      if (width > bestWidth) {
        bestWidth = width;
        best = vec((xs[k] + xs[k + 1]) / 2, y);
      }
    }
  }
  return best;
}

/** Proper intersection of two segments (shared end points do not count). */
export function segmentsIntersect(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): boolean {
  const d1 = cross(subVec(a2, a1), subVec(b1, a1));
  const d2 = cross(subVec(a2, a1), subVec(b2, a1));
  const d3 = cross(subVec(b2, b1), subVec(a1, b1));
  const d4 = cross(subVec(b2, b1), subVec(a2, b1));
  return d1 * d2 < -GEOMETRY_EPSILON && d3 * d4 < -GEOMETRY_EPSILON;
}

/** True when no two non-adjacent edges cross and the polygon has a positive area. */
export function isSimplePolygon(points: Polygon): boolean {
  const n = points.length;
  if (n < 3 || polygonArea(points) < 1) {
    return false;
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const adjacent = j === i + 1 || (i === 0 && j === n - 1);
      if (!adjacent && segmentsIntersect(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) {
        return false;
      }
    }
  }
  return true;
}

/** Closest point to `point` on the segment a–b and its parameter t ∈ [0, 1]. */
export function closestPointOnSegment(point: Vec2, a: Vec2, b: Vec2): { point: Vec2; t: number } {
  const ab = subVec(b, a);
  const lengthSquared = dot(ab, ab);
  const t = lengthSquared === 0 ? 0 : clamp(dot(subVec(point, a), ab) / lengthSquared, 0, 1);
  return { point: addVec(a, ab, t), t };
}

/** Maximum miter length relative to the offset distance (avoids spikes at very sharp corners). */
export const MITER_LIMIT = 4;

/** Mitered offset of a vertex between edges with outward normals n0 (incoming) and n1 (outgoing). */
export function miterOffset(point: Vec2, n0: Vec2, n1: Vec2, distance: number): Vec2 {
  const miter = normalize(addVec(n0, n1));
  const cos = dot(miter, n0);
  if (length(miter) === 0 || cos < 1 / MITER_LIMIT) {
    return addVec(point, n1, distance);
  }
  return addVec(point, miter, distance / cos);
}
