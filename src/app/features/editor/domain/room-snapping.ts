import { addVec, closestPointOnSegment, distanceBetween, dot, subVec, Vec2, vec } from '../../../core/domain/geometry';
import { Room } from '../../project/domain/model';
import { roomOuterPolygon, translateRoom, WallEdge, wallEdges } from '../../project/domain/room-geometry';
import { snapToGrid } from './snapping';

/** Edges count as parallel when the cosine of their angle exceeds this. */
const PARALLEL_COS = 0.995;
const AXIS_EPSILON = 1e-6;

export type Segment = readonly [Vec2, Vec2];

export interface RoomSnapResult {
  /** Corrected translation. */
  readonly delta: Vec2;
  /** Wall segments the room is glued to (for visual feedback). */
  readonly glued: readonly Segment[];
}

interface NormalCandidate {
  /** Unit vector the correction is measured along. */
  readonly normal: Vec2;
  readonly correction: number;
  /** Shared wall segment when this candidate glues two rooms. */
  readonly glue: Segment | null;
}

function overlapAlong(edge: WallEdge, other: WallEdge, slack: number): Segment | null {
  const u1 = dot(subVec(edge.start, other.start), other.direction);
  const u2 = dot(subVec(edge.end, other.start), other.direction);
  const from = Math.max(0, Math.min(u1, u2));
  const to = Math.min(other.length, Math.max(u1, u2));
  if (to - from < -slack) {
    return null;
  }
  return [addVec(other.start, other.direction, from), addVec(other.start, other.direction, Math.max(from, to))];
}

/** Candidate corrections that glue (or align) one edge of the moving room to an edge of another room. */
function normalCandidates(moving: Room, others: readonly Room[], threshold: number): NormalCandidate[] {
  const movingEdges = wallEdges(moving);
  const candidates: NormalCandidate[] = [];
  for (const other of others) {
    for (const target of wallEdges(other)) {
      for (const edge of movingEdges) {
        const cos = dot(edge.direction, target.direction);
        if (Math.abs(cos) < PARALLEL_COS) continue;
        const overlap = overlapAlong(edge, target, threshold);
        const distance = dot(subVec(edge.start, target.start), target.normal);
        if (cos < 0) {
          // Opposite walls: put the inner face onto the outer face of the other wall (shared wall).
          const correction = other.wallThickness - distance;
          if (overlap && Math.abs(correction) <= threshold) {
            candidates.push({ normal: target.normal, correction, glue: overlap });
          }
        } else {
          // Walls in a row: align inner faces and outer faces.
          for (const offset of [0, other.wallThickness - moving.wallThickness]) {
            const correction = offset - distance;
            if (Math.abs(correction) <= threshold) candidates.push({ normal: target.normal, correction, glue: null });
          }
        }
      }
    }
  }
  return candidates;
}

const byCorrection = (a: NormalCandidate, b: NormalCandidate): number =>
  Math.abs(a.correction) - Math.abs(b.correction) || (a.glue ? -1 : 1) - (b.glue ? -1 : 1);

function vertexAlignment(moving: Room, others: readonly Room[], axis: Vec2, threshold: number): number | null {
  const own = [...moving.points, ...roomOuterPolygon(moving)].map((p) => dot(p, axis));
  const targets = others.flatMap((other) => [...other.points, ...roomOuterPolygon(other)]).map((p) => dot(p, axis));
  let best: number | null = null;
  for (const value of own) {
    for (const target of targets) {
      const correction = target - value;
      if (Math.abs(correction) <= threshold && (best === null || Math.abs(correction) < Math.abs(best))) {
        best = correction;
      }
    }
  }
  return best;
}

const isAxis = (v: Vec2): boolean => Math.abs(v.x) < AXIS_EPSILON || Math.abs(v.y) < AXIS_EPSILON;

/**
 * Snaps a room translation so that walls of the room glue to walls of neighbouring rooms
 * (inner face on the other room's outer face → the wall is shared). Falls back to the grid.
 */
export function snapRoomTranslation(
  room: Room,
  delta: Vec2,
  others: readonly Room[],
  threshold: number,
  gridSize: number | null,
): RoomSnapResult {
  const origin = room.points[0];
  const gridDelta = (d: Vec2): Vec2 =>
    gridSize
      ? vec(snapToGrid(origin.x + d.x, gridSize) - origin.x, snapToGrid(origin.y + d.y, gridSize) - origin.y)
      : d;

  const first = normalCandidates(translateRoom(room, delta), others, threshold).sort(byCorrection)[0];
  if (!first) {
    return { delta: gridDelta(delta), glued: [] };
  }
  let snapped = addVec(delta, first.normal, first.correction);
  const glued: Segment[] = first.glue ? [first.glue] : [];
  const tangent = vec(-first.normal.y, first.normal.x);

  // Second constraint: another wall that is not parallel to the first one.
  const second = normalCandidates(translateRoom(room, snapped), others, threshold)
    .filter((candidate) => Math.abs(dot(candidate.normal, first.normal)) < 0.9)
    .sort(byCorrection)[0];
  if (second) {
    snapped = addVec(snapped, tangent, second.correction / dot(tangent, second.normal));
    if (second.glue) glued.push(second.glue);
    return { delta: snapped, glued };
  }

  const along = vertexAlignment(translateRoom(room, snapped), others, tangent, threshold);
  if (along !== null) {
    snapped = addVec(snapped, tangent, along);
  } else if (gridSize && isAxis(tangent)) {
    const grid = gridDelta(snapped);
    snapped = Math.abs(tangent.x) > Math.abs(tangent.y) ? vec(grid.x, snapped.y) : vec(snapped.x, grid.y);
  }
  return { delta: snapped, glued };
}

export interface VertexSnapContext {
  /** Rooms the point may glue to (the edited room itself excluded). */
  readonly others: readonly Room[];
  /** Neighbouring vertices of the edited outline (for horizontal/vertical alignment). */
  readonly neighbours: readonly Vec2[];
  readonly threshold: number;
  readonly gridSize: number | null;
}

export interface VertexSnapResult {
  readonly point: Vec2;
  readonly guide: Segment | null;
}

/**
 * Snaps a corner of a room outline: to outer corners of other rooms, onto their outer wall
 * faces (gluing), horizontally/vertically to neighbouring corners, otherwise to the grid.
 */
export function snapVertex(point: Vec2, context: VertexSnapContext): VertexSnapResult {
  const { others, neighbours, threshold, gridSize } = context;
  const outlines = others.map((other) => roomOuterPolygon(other));

  let bestCorner: Vec2 | null = null;
  for (const corner of outlines.flat()) {
    if (
      distanceBetween(corner, point) <= threshold &&
      (!bestCorner || distanceBetween(corner, point) < distanceBetween(bestCorner, point))
    ) {
      bestCorner = corner;
    }
  }
  if (bestCorner) {
    return { point: bestCorner, guide: null };
  }

  let x = gridSize ? snapToGrid(point.x, gridSize) : point.x;
  let y = gridSize ? snapToGrid(point.y, gridSize) : point.y;
  let alignedX = false;
  let alignedY = false;
  for (const neighbour of neighbours) {
    if (!alignedX && Math.abs(neighbour.x - point.x) <= threshold) {
      x = neighbour.x;
      alignedX = true;
    }
    if (!alignedY && Math.abs(neighbour.y - point.y) <= threshold) {
      y = neighbour.y;
      alignedY = true;
    }
  }

  for (const outline of outlines) {
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i];
      const b = outline[(i + 1) % outline.length];
      const closest = closestPointOnSegment(point, a, b).point;
      if (distanceBetween(closest, point) <= threshold) {
        // Keep an alignment that is compatible with the wall line where possible.
        const onWall =
          alignedX && Math.abs(b.x - a.x) > AXIS_EPSILON
            ? vec(x, a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x))
            : alignedY && Math.abs(b.y - a.y) > AXIS_EPSILON
              ? vec(a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y), y)
              : closest;
        const valid = closestPointOnSegment(onWall, a, b).point;
        return { point: distanceBetween(valid, onWall) < 1 ? onWall : closest, guide: [a, b] };
      }
    }
  }
  return { point: vec(x, y), guide: null };
}
