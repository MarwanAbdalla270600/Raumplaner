import {
  Aabb,
  aabbFromPoints,
  addVec,
  distanceBetween,
  ensureClockwise,
  miterOffset,
  normalize,
  pointInPolygon,
  Polygon,
  polygonArea,
  polygonLabelPoint,
  polygonSignedArea,
  subVec,
  translatePolygon,
  Vec2,
  vec,
} from '../../../core/domain/geometry';
import { Opening, Room, WallIndex } from './model';

/** One wall of a room, derived from an edge of its floor polygon. */
export interface WallEdge {
  readonly index: WallIndex;
  readonly start: Vec2;
  readonly end: Vec2;
  readonly length: number;
  /** Unit vector from start to end. */
  readonly direction: Vec2;
  /** Unit vector pointing out of the room (into the wall). */
  readonly normal: Vec2;
}

export function rectanglePoints(x: number, y: number, width: number, depth: number): Vec2[] {
  return [vec(x, y), vec(x + width, y), vec(x + width, y + depth), vec(x, y + depth)];
}

export function wallCount(room: Room): number {
  return room.points.length;
}

export function wallEdge(room: Room, index: WallIndex): WallEdge {
  const n = room.points.length;
  const start = room.points[((index % n) + n) % n];
  const end = room.points[(((index + 1) % n) + n) % n];
  const direction = normalize(subVec(end, start));
  // Clockwise polygon on screen (y down): the outward normal is the direction rotated left.
  return {
    index,
    start,
    end,
    length: distanceBetween(start, end),
    direction,
    normal: vec(direction.y, -direction.x),
  };
}

export function wallEdges(room: Room): WallEdge[] {
  return room.points.map((_, index) => wallEdge(room, index));
}

/** Inner floor outline of the room. */
export function roomPolygon(room: Room): Polygon {
  return room.points;
}

/** Outer outline (outer faces of the walls) with mitered corners. */
export function roomOuterPolygon(room: Room, thickness = room.wallThickness): Vec2[] {
  const edges = wallEdges(room);
  const n = edges.length;
  return room.points.map((point, i) => miterOffset(point, edges[(i - 1 + n) % n].normal, edges[i].normal, thickness));
}

/** Inner floor area of the room as bounding box. */
export function roomInnerBounds(room: Room): Aabb {
  return aabbFromPoints(room.points);
}

/** Room including its walls. */
export function roomOuterBounds(room: Room): Aabb {
  return aabbFromPoints(roomOuterPolygon(room));
}

/** Length of the inner face of a wall. */
export function wallLength(room: Room, index: WallIndex): number {
  return wallEdge(room, index).length;
}

/**
 * Point on a wall: `along` is measured from the wall start along the inner face, `across`
 * from the inner face outwards. At the wall ends the point follows the mitered corner.
 */
export function wallPoint(room: Room, index: WallIndex, along: number, across: number): Vec2 {
  const edge = wallEdge(room, index);
  const n = room.points.length;
  const endTolerance = 1e-6;
  if (along <= endTolerance) {
    return miterOffset(edge.start, wallEdge(room, index - 1 + n).normal, edge.normal, across);
  }
  if (along >= edge.length - endTolerance) {
    return miterOffset(edge.end, edge.normal, wallEdge(room, index + 1).normal, across);
  }
  return addVec(addVec(edge.start, edge.direction, along), edge.normal, across);
}

/** Quadrilateral occupied by a wall section between `from` and `to` (along the wall). */
export function wallSectionPolygon(
  room: Room,
  index: WallIndex,
  from: number,
  to: number,
  inner = 0,
  outer = room.wallThickness,
): Vec2[] {
  return [
    wallPoint(room, index, from, inner),
    wallPoint(room, index, to, inner),
    wallPoint(room, index, to, outer),
    wallPoint(room, index, from, outer),
  ];
}

/** Polygon occupied by a whole wall (corners are mitered so the outline is closed). */
export function wallPolygon(room: Room, index: WallIndex): Vec2[] {
  return wallSectionPolygon(room, index, 0, wallLength(room, index));
}

export function wallPolygons(room: Room): Vec2[][] {
  return room.points.map((_, index) => wallPolygon(room, index));
}

/** Polygon of an opening cut into its wall. */
export function openingPolygon(room: Room, opening: Opening): Vec2[] {
  const edge = wallEdge(room, opening.wall);
  const a = addVec(edge.start, edge.direction, opening.offset);
  const b = addVec(edge.start, edge.direction, opening.offset + opening.width);
  return [a, b, addVec(b, edge.normal, room.wallThickness), addVec(a, edge.normal, room.wallThickness)];
}

/** Largest valid offset for an opening of the given width on a wall. */
export function maxOpeningOffset(room: Room, wall: WallIndex, width: number): number {
  return Math.max(0, wallLength(room, wall) - width);
}

export function clampOpening(room: Room, opening: Opening): Opening {
  const wall = Math.min(Math.max(0, Math.round(opening.wall)), room.points.length - 1);
  const width = Math.min(opening.width, wallLength(room, wall));
  const height = Math.min(opening.height, room.height);
  const sillHeight = Math.min(opening.sillHeight, Math.max(0, room.height - height));
  const offset = Math.min(Math.max(0, opening.offset), maxOpeningOffset(room, wall, width));
  return { ...opening, wall, width, height, sillHeight, offset };
}

/** Keeps openings valid after a room has been reshaped. */
export function withClampedOpenings(room: Room): Room {
  return { ...room, openings: room.openings.map((opening) => clampOpening(room, opening)) };
}

export function roomContainsPoint(room: Room, point: Vec2): boolean {
  return pointInPolygon(point, room.points);
}

/** A point inside the room that is suitable for its label. */
export function roomCenter(room: Room): Vec2 {
  return polygonLabelPoint(room.points);
}

export function roomArea(room: Room): number {
  return polygonArea(room.points);
}

export function roomOrigin(room: Room): Vec2 {
  const bounds = roomInnerBounds(room);
  return vec(bounds.minX, bounds.minY);
}

export function roomSize(room: Room): { width: number; depth: number } {
  const bounds = roomInnerBounds(room);
  return { width: bounds.maxX - bounds.minX, depth: bounds.maxY - bounds.minY };
}

export function translateRoom(room: Room, delta: Vec2): Room {
  return { ...room, points: translatePolygon(room.points, delta) };
}

/** Moves the room so that the top-left corner of its bounding box is at (x, y). */
export function moveRoomTo(room: Room, x: number, y: number): Room {
  const origin = roomOrigin(room);
  return translateRoom(room, vec(x - origin.x, y - origin.y));
}

/** Scales the room outline so that its bounding box gets the given size (top-left stays). */
export function resizeRoom(room: Room, width: number, depth: number): Room {
  const origin = roomOrigin(room);
  const size = roomSize(room);
  const sx = size.width > 0 ? width / size.width : 1;
  const sy = size.depth > 0 ? depth / size.depth : 1;
  const points = room.points.map((p) => vec(origin.x + (p.x - origin.x) * sx, origin.y + (p.y - origin.y) * sy));
  const scaled = { ...room, points };
  return withClampedOpenings({
    ...scaled,
    openings: room.openings.map((opening) => {
      const ratio = wallLength(scaled, opening.wall) / Math.max(1, wallLength(room, opening.wall));
      return { ...opening, offset: opening.offset * ratio };
    }),
  });
}

/** Replaces the outline; keeps openings on their walls and normalizes the orientation. */
export function withPoints(room: Room, points: readonly Vec2[]): Room {
  if (polygonSignedArea(points) >= 0) {
    return withClampedOpenings({ ...room, points: [...points] });
  }
  const clockwise = ensureClockwise(points);
  // Reversing the order maps wall i to wall n-2-i (mod n) and flips the offset direction.
  const n = points.length;
  const reshaped = { ...room, points: clockwise };
  return withClampedOpenings({
    ...reshaped,
    openings: room.openings.map((opening) => {
      const wall = (((n - 2 - opening.wall) % n) + n) % n;
      return { ...opening, wall, offset: wallLength(reshaped, wall) - opening.offset - opening.width };
    }),
  });
}

export function moveVertex(room: Room, index: number, point: Vec2): Room {
  return withClampedOpenings({ ...room, points: room.points.map((p, i) => (i === index ? point : p)) });
}

/** Splits wall `wall` at `point` (inserted after points[wall]). Openings stay where they are. */
export function insertVertex(room: Room, wall: WallIndex, point: Vec2): Room {
  const splitAt = distanceBetween(room.points[wall], point);
  const points = [...room.points.slice(0, wall + 1), point, ...room.points.slice(wall + 1)];
  const openings = room.openings.map((opening) => {
    if (opening.wall > wall) return { ...opening, wall: opening.wall + 1 };
    if (opening.wall < wall || opening.offset + opening.width / 2 < splitAt) return opening;
    return { ...opening, wall: wall + 1, offset: opening.offset - splitAt };
  });
  return withClampedOpenings({ ...room, points, openings });
}

/** Removes a corner (rooms keep at least three). Openings of the merged walls are kept. */
export function removeVertex(room: Room, index: number): Room {
  const n = room.points.length;
  if (n <= 3) {
    return room;
  }
  const previous = (index - 1 + n) % n;
  const previousLength = wallLength(room, previous);
  const points = room.points.filter((_, i) => i !== index);
  const openings = room.openings.map((opening) => {
    let { wall, offset } = opening;
    if (wall === index) {
      wall = previous;
      offset += previousLength;
    }
    if (wall > index) wall -= 1;
    return { ...opening, wall, offset };
  });
  return withClampedOpenings({ ...room, points, openings });
}

/**
 * Outline of a rectangular room glued to the outside of `wall`: it shares the wall
 * (its inner face lies on the outer face of this room's wall) and has the given depth.
 */
export function pointsAttachedToWall(room: Room, wall: WallIndex, depth: number): Vec2[] {
  const edge = wallEdge(room, wall);
  const start = addVec(edge.start, edge.normal, room.wallThickness);
  const end = addVec(edge.end, edge.normal, room.wallThickness);
  return ensureClockwise([end, start, addVec(start, edge.normal, depth), addVec(end, edge.normal, depth)]);
}
