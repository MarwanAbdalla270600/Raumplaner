import { Aabb, unionAabb } from '../../../core/domain/geometry';
import { furnitureBounds } from '../../project/domain/furniture-geometry';
import { Floor, Opening, Room, WALL_SIDES, WallSide } from '../../project/domain/model';
import { roomOuterBounds, wallLength, wallRect } from '../../project/domain/room-geometry';

/**
 * Framework-free description of the 3D scene. Plan coordinates (x, y) map to 3D (x, z);
 * `elevation` is the bottom of a box above the floor. All values are centimetres.
 */
export interface SceneBox {
  readonly id: string;
  readonly kind: 'furniture' | 'wall' | 'glass';
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  /** Clockwise rotation in the plan, degrees. */
  readonly rotation: number;
  readonly color: string;
}

export interface SceneSurface {
  readonly id: string;
  readonly kind: 'floor' | 'ceiling';
  readonly bounds: Aabb;
  readonly height: number;
  readonly color: string;
}

export interface SceneDescription {
  readonly boxes: readonly SceneBox[];
  readonly surfaces: readonly SceneSurface[];
  readonly bounds: Aabb;
  readonly maxHeight: number;
}

const GLASS_COLOR = '#9ccbe6';
const GLASS_THICKNESS_RATIO = 0.2;
const CEILING_COLOR = '#ffffff';
const MIN_PIECE_LENGTH = 0.5;

interface Interval {
  readonly start: number;
  readonly end: number;
}

interface WallGeometry {
  readonly room: Room;
  readonly rect: Aabb;
  readonly horizontal: boolean;
}

interface PieceOptions {
  readonly kind?: SceneBox['kind'];
  readonly color?: string;
  /** Fraction of the wall thickness (glass panes are thinner). */
  readonly depthFactor?: number;
}

/** Box for the part of a wall between `interval.start` and `interval.end` (measured along the wall). */
function wallPiece(
  wall: WallGeometry,
  id: string,
  interval: Interval,
  elevation: number,
  height: number,
  options: PieceOptions = {},
): SceneBox {
  const { rect, horizontal, room } = wall;
  const thickness = room.wallThickness * (options.depthFactor ?? 1);
  const center = (interval.start + interval.end) / 2;
  const length = interval.end - interval.start;
  return {
    id,
    kind: options.kind ?? 'wall',
    x: horizontal ? rect.minX + center : (rect.minX + rect.maxX) / 2,
    y: horizontal ? (rect.minY + rect.maxY) / 2 : rect.minY + center,
    elevation,
    width: horizontal ? length : thickness,
    depth: horizontal ? thickness : length,
    height,
    rotation: 0,
    color: options.color ?? room.wallColor,
  };
}

/** Sill, lintel and glass pieces for one opening. */
function openingPieces(wall: WallGeometry, opening: Opening, span: Interval): SceneBox[] {
  const { room } = wall;
  const pieces: SceneBox[] = [];
  if (opening.sillHeight > 0) {
    pieces.push(wallPiece(wall, `${opening.id}-sill`, span, 0, opening.sillHeight));
  }
  const top = opening.sillHeight + opening.height;
  if (room.height - top > MIN_PIECE_LENGTH) {
    pieces.push(wallPiece(wall, `${opening.id}-lintel`, span, top, room.height - top));
  }
  if (opening.kind === 'window') {
    pieces.push(
      wallPiece(wall, `${opening.id}-glass`, span, opening.sillHeight, opening.height, {
        kind: 'glass',
        color: GLASS_COLOR,
        depthFactor: GLASS_THICKNESS_RATIO,
      }),
    );
  }
  return pieces;
}

/** Splits a wall into solid pieces around its openings (sill and lintel pieces included). */
export function wallPieces(room: Room, side: WallSide): SceneBox[] {
  const horizontal = side === 'north' || side === 'south';
  const wall: WallGeometry = { room, rect: wallRect(room, side), horizontal };
  // Wall rectangles of north/south include the corners, openings are measured from the inner corner.
  const cornerOffset = horizontal ? room.wallThickness : 0;
  const totalLength = wallLength(room, side) + 2 * cornerOffset;
  const openings = room.openings.filter((opening) => opening.wall === side).sort((a, b) => a.offset - b.offset);

  const pieces: SceneBox[] = [];
  let cursor = 0;
  openings.forEach((opening, index) => {
    const span = { start: cornerOffset + opening.offset, end: cornerOffset + opening.offset + opening.width };
    if (span.start - cursor > MIN_PIECE_LENGTH) {
      pieces.push(
        wallPiece(wall, `${room.id}-${side}-solid-${index}`, { start: cursor, end: span.start }, 0, room.height),
      );
    }
    pieces.push(...openingPieces(wall, opening, span));
    cursor = Math.max(cursor, span.end);
  });
  if (totalLength - cursor > MIN_PIECE_LENGTH) {
    pieces.push(wallPiece(wall, `${room.id}-${side}-solid-end`, { start: cursor, end: totalLength }, 0, room.height));
  }
  return pieces;
}

export function describeScene(floor: Floor): SceneDescription {
  const walls = floor.rooms.flatMap((room) => WALL_SIDES.flatMap((side) => wallPieces(room, side)));
  const furniture: SceneBox[] = floor.furniture.map((item) => ({
    id: item.id,
    kind: 'furniture',
    x: item.x,
    y: item.y,
    elevation: item.elevation,
    width: item.width,
    depth: item.depth,
    height: item.height,
    rotation: item.rotation,
    color: item.color,
  }));
  const surfaces: SceneSurface[] = floor.rooms.flatMap((room) => {
    const bounds = { minX: room.x, minY: room.y, maxX: room.x + room.width, maxY: room.y + room.depth };
    return [
      { id: `${room.id}-floor`, kind: 'floor' as const, bounds, height: 0, color: room.floorColor },
      { id: `${room.id}-ceiling`, kind: 'ceiling' as const, bounds, height: room.height, color: CEILING_COLOR },
    ];
  });
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
  return { boxes: [...walls, ...furniture], surfaces, bounds, maxHeight };
}
