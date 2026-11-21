import { Aabb, aabb, aabbContainsPoint, aabbFromRect, expandAabb, Vec2, vec } from '../../../core/domain/geometry';
import { Opening, Room, WallSide } from './model';

/** Inner floor area of the room. */
export function roomInnerBounds(room: Room): Aabb {
  return aabbFromRect(room.x, room.y, room.width, room.depth);
}

/** Room including its walls. */
export function roomOuterBounds(room: Room): Aabb {
  return expandAabb(roomInnerBounds(room), room.wallThickness);
}

/** Length of the inner face of a wall. */
export function wallLength(room: Room, side: WallSide): number {
  return side === 'north' || side === 'south' ? room.width : room.depth;
}

/** Rectangle occupied by a wall (walls overlap in the corners so the outline is closed). */
export function wallRect(room: Room, side: WallSide): Aabb {
  const inner = roomInnerBounds(room);
  const t = room.wallThickness;
  switch (side) {
    case 'north':
      return aabb(inner.minX - t, inner.minY - t, inner.maxX + t, inner.minY);
    case 'south':
      return aabb(inner.minX - t, inner.maxY, inner.maxX + t, inner.maxY + t);
    case 'west':
      return aabb(inner.minX - t, inner.minY, inner.minX, inner.maxY);
    case 'east':
      return aabb(inner.maxX, inner.minY, inner.maxX + t, inner.maxY);
  }
}

export function wallRects(room: Room): Aabb[] {
  return (['north', 'east', 'south', 'west'] as const).map((side) => wallRect(room, side));
}

/** Rectangle of an opening cut into its wall. */
export function openingRect(room: Room, opening: Opening): Aabb {
  const wall = wallRect(room, opening.wall);
  const horizontal = opening.wall === 'north' || opening.wall === 'south';
  if (horizontal) {
    const start = room.x + opening.offset;
    return aabb(start, wall.minY, start + opening.width, wall.maxY);
  }
  const start = room.y + opening.offset;
  return aabb(wall.minX, start, wall.maxX, start + opening.width);
}

/** Largest valid offset for an opening of the given width on a wall. */
export function maxOpeningOffset(room: Room, side: WallSide, width: number): number {
  return Math.max(0, wallLength(room, side) - width);
}

export function clampOpening(room: Room, opening: Opening): Opening {
  const width = Math.min(opening.width, wallLength(room, opening.wall));
  const height = Math.min(opening.height, room.height);
  const sillHeight = Math.min(opening.sillHeight, Math.max(0, room.height - height));
  const offset = Math.min(Math.max(0, opening.offset), maxOpeningOffset(room, opening.wall, width));
  return { ...opening, width, height, sillHeight, offset };
}

/** Keeps openings valid after a room has been resized. */
export function withClampedOpenings(room: Room): Room {
  return { ...room, openings: room.openings.map((opening) => clampOpening(room, opening)) };
}

export function roomContainsPoint(room: Room, point: Vec2): boolean {
  return aabbContainsPoint(roomInnerBounds(room), point);
}

export function roomCenter(room: Room): Vec2 {
  return vec(room.x + room.width / 2, room.y + room.depth / 2);
}

export function roomArea(room: Room): number {
  return room.width * room.depth;
}
