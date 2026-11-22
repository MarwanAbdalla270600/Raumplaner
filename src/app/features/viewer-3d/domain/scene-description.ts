import { Aabb, addVec, dot, Polygon, subVec, unionAabb } from '../../../core/domain/geometry';
import { furnitureBounds } from '../../project/domain/furniture-geometry';
import { Floor, Room } from '../../project/domain/model';
import { roomOuterBounds, wallEdge, WallEdge, wallEdges, wallSectionPolygon } from '../../project/domain/room-geometry';
import { furnitureModel, ModelPart } from './furniture-models';

/**
 * Framework-free description of the 3D scene. Plan coordinates (x, y) map to 3D (x, z);
 * heights are measured upwards from the floor. All values are centimetres.
 */
export interface ScenePrism {
  readonly id: string;
  readonly kind: 'wall' | 'glass';
  /** Convex footprint on the floor plan. */
  readonly footprint: Polygon;
  readonly elevation: number;
  readonly height: number;
  readonly color: string;
}

export interface SceneSurface {
  readonly id: string;
  readonly kind: 'floor' | 'ceiling';
  readonly polygon: Polygon;
  readonly height: number;
  readonly color: string;
}

export interface SceneFurniture {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  /** Clockwise rotation in the plan, degrees. */
  readonly rotation: number;
  readonly parts: readonly ModelPart[];
}

export interface SceneDescription {
  readonly walls: readonly ScenePrism[];
  readonly surfaces: readonly SceneSurface[];
  readonly furniture: readonly SceneFurniture[];
  readonly bounds: Aabb;
  readonly maxHeight: number;
}

const GLASS_COLOR = '#9ccbe6';
const GLASS_THICKNESS = 2;
const CEILING_COLOR = '#ffffff';
const MIN_PIECE_LENGTH = 0.5;
/** Walls closer to parallel than this count as facing each other. */
const OPPOSITE_COS = -0.999;
const SHARED_DISTANCE_TOLERANCE = 2;

interface Interval {
  readonly from: number;
  readonly to: number;
}

/** Part of a wall that another room's wall lies on (the wall is shared). */
export interface SharedSpan extends Interval {
  /** Distance between the two inner faces = total thickness of the shared wall. */
  readonly gap: number;
}

/** An opening cut into a wall, in wall coordinates. */
interface Cut extends Interval {
  readonly bottom: number;
  readonly top: number;
  /** Only the owner of a window renders its glass. */
  readonly glass: boolean;
}

function intervalOnEdge(edge: WallEdge, a: { x: number; y: number }, b: { x: number; y: number }): Interval {
  const u1 = dot(subVec(a, edge.start), edge.direction);
  const u2 = dot(subVec(b, edge.start), edge.direction);
  return { from: Math.min(u1, u2), to: Math.max(u1, u2) };
}

/** Walls of other rooms that lie directly behind this wall (shared walls). */
export function sharedSpans(
  room: Room,
  wall: number,
  rooms: readonly Room[],
): (SharedSpan & { other: Room; otherWall: number })[] {
  const edge = wallEdge(room, wall);
  const spans: (SharedSpan & { other: Room; otherWall: number })[] = [];
  for (const other of rooms) {
    if (other.id === room.id) continue;
    for (const otherEdge of wallEdges(other)) {
      if (dot(edge.direction, otherEdge.direction) > OPPOSITE_COS) continue;
      const gap = dot(subVec(otherEdge.start, edge.start), edge.normal);
      const expected = [room.wallThickness, other.wallThickness];
      if (gap <= 0 || !expected.some((t) => Math.abs(gap - t) <= Math.max(SHARED_DISTANCE_TOLERANCE, t * 0.25)))
        continue;
      const { from, to } = intervalOnEdge(edge, otherEdge.start, otherEdge.end);
      const clipped = { from: Math.max(0, from), to: Math.min(edge.length, to) };
      if (clipped.to - clipped.from > 1) {
        spans.push({ ...clipped, gap, other, otherWall: otherEdge.index });
      }
    }
  }
  return spans;
}

function wallCuts(room: Room, wall: number, rooms: readonly Room[], spans: ReturnType<typeof sharedSpans>): Cut[] {
  const own: Cut[] = room.openings
    .filter((opening) => opening.wall === wall)
    .map((opening) => ({
      from: opening.offset,
      to: opening.offset + opening.width,
      bottom: opening.sillHeight,
      top: opening.sillHeight + opening.height,
      glass: opening.kind === 'window',
    }));
  // Openings of the neighbour in the shared wall must cut through this half as well.
  const edge = wallEdge(room, wall);
  const foreign: Cut[] = spans.flatMap((span) => {
    const otherEdge = wallEdge(span.other, span.otherWall);
    return span.other.openings
      .filter((opening) => opening.wall === span.otherWall)
      .map((opening) => {
        const a = addVec(otherEdge.start, otherEdge.direction, opening.offset);
        const b = addVec(otherEdge.start, otherEdge.direction, opening.offset + opening.width);
        const interval = intervalOnEdge(edge, a, b);
        return {
          from: Math.max(span.from, interval.from),
          to: Math.min(span.to, interval.to),
          bottom: opening.sillHeight,
          top: opening.sillHeight + opening.height,
          glass: false,
        };
      })
      .filter((cut) => cut.to - cut.from > MIN_PIECE_LENGTH);
  });
  return [...own, ...foreign];
}

/** Solid vertical intervals of [0, height] after removing the given openings. */
function solidIntervals(height: number, holes: readonly { bottom: number; top: number }[]): Interval[] {
  const sorted = [...holes].sort((a, b) => a.bottom - b.bottom);
  const result: Interval[] = [];
  let cursor = 0;
  for (const hole of sorted) {
    if (hole.bottom - cursor > MIN_PIECE_LENGTH) result.push({ from: cursor, to: Math.min(hole.bottom, height) });
    cursor = Math.max(cursor, hole.top);
  }
  if (height - cursor > MIN_PIECE_LENGTH) result.push({ from: cursor, to: height });
  return result;
}

/**
 * Splits a wall into prisms: around openings (sill and lintel pieces) and – where the wall is
 * shared with a neighbouring room – only this room's half of the thickness, in its own colour.
 */
export function wallPieces(room: Room, wall: number, rooms: readonly Room[] = [room]): ScenePrism[] {
  const edge = wallEdge(room, wall);
  const spans = sharedSpans(room, wall, rooms);
  const cuts = wallCuts(room, wall, rooms, spans);
  const breaks = [0, edge.length, ...cuts.flatMap((c) => [c.from, c.to]), ...spans.flatMap((s) => [s.from, s.to])]
    .map((value) => Math.min(edge.length, Math.max(0, value)))
    .sort((a, b) => a - b)
    .filter((value, index, all) => index === 0 || value - all[index - 1] > MIN_PIECE_LENGTH);

  const pieces: ScenePrism[] = [];
  for (let i = 0; i + 1 < breaks.length; i++) {
    const from = breaks[i];
    const to = breaks[i + 1];
    const mid = (from + to) / 2;
    const shared = spans.find((span) => mid > span.from && mid < span.to);
    const outer = shared ? shared.gap / 2 : room.wallThickness;
    const holes = cuts.filter((cut) => mid > cut.from && mid < cut.to);
    const footprint = wallSectionPolygon(room, wall, from, to, 0, outer);
    solidIntervals(room.height, holes).forEach((interval, k) =>
      pieces.push({
        id: `${room.id}-w${wall}-${i}-${k}`,
        kind: 'wall',
        footprint,
        elevation: interval.from,
        height: interval.to - interval.from,
        color: room.wallColor,
      }),
    );
    holes
      .filter((hole) => hole.glass)
      .forEach((hole, k) => {
        const centre = shared ? shared.gap / 2 : room.wallThickness / 2;
        pieces.push({
          id: `${room.id}-w${wall}-${i}-glass-${k}`,
          kind: 'glass',
          footprint: wallSectionPolygon(
            room,
            wall,
            from,
            to,
            centre - GLASS_THICKNESS / 2,
            centre + GLASS_THICKNESS / 2,
          ),
          elevation: hole.bottom,
          height: hole.top - hole.bottom,
          color: GLASS_COLOR,
        });
      });
  }
  return pieces;
}

export function describeScene(floor: Floor): SceneDescription {
  const walls = floor.rooms.flatMap((room) => room.points.flatMap((_, wall) => wallPieces(room, wall, floor.rooms)));
  const furniture: SceneFurniture[] = floor.furniture.map((item) => ({
    id: item.id,
    x: item.x,
    y: item.y,
    elevation: item.elevation,
    rotation: item.rotation,
    parts: furnitureModel(item),
  }));
  const surfaces: SceneSurface[] = floor.rooms.flatMap((room) => [
    { id: `${room.id}-floor`, kind: 'floor' as const, polygon: room.points, height: 0, color: room.floorColor },
    {
      id: `${room.id}-ceiling`,
      kind: 'ceiling' as const,
      polygon: room.points,
      height: room.height,
      color: CEILING_COLOR,
    },
  ]);
  const bounds = unionAabb([...floor.rooms.map(roomOuterBounds), ...floor.furniture.map(furnitureBounds)]) ?? {
    minX: -100,
    minY: -100,
    maxX: 100,
    maxY: 100,
  };
  const maxHeight = Math.max(
    250,
    ...floor.rooms.map((room) => room.height),
    ...floor.furniture.map((item) => item.elevation + item.height),
  );
  return { walls, surfaces, furniture, bounds, maxHeight };
}
