import {
  Aabb,
  distanceBetween,
  isSimplePolygon,
  polygonArea,
  translateAabb,
  unionAabb,
  Vec2,
  vec,
} from '../../../core/domain/geometry';
import { EntityId } from '../../../core/domain/id';
import { furnitureBounds } from '../../project/domain/furniture-geometry';
import { Floor, FurnitureItem, Room } from '../../project/domain/model';
import { insertVertex, moveVertex, roomContainsPoint, translateRoom } from '../../project/domain/room-geometry';
import { DIMENSION_LIMITS } from '../../project/domain/defaults';
import { axisAlignedWallBounds } from '../domain/collision';
import { Segment, snapRoomTranslation, snapVertex } from '../domain/room-snapping';
import { snapBounds, snapTargetsFromBounds } from '../domain/snapping';
import { translateFurniture } from '../domain/transform';
import { Preview } from './editor-state';

export interface SnapOptions {
  readonly enabled: boolean;
  readonly gridSize: number;
  /** Snap distance in world units (cm). */
  readonly threshold: number;
}

const EMPTY_MAP = new Map<never, never>();

/** Moves a set of furniture items with object and grid snapping. */
export class FurnitureDragSession {
  private readonly items: readonly FurnitureItem[];
  private readonly startBounds: Aabb | null;
  private readonly obstacles: readonly Aabb[];

  constructor(
    floor: Floor,
    ids: ReadonlySet<EntityId>,
    private readonly snap: SnapOptions,
  ) {
    this.items = floor.furniture.filter((item) => ids.has(item.id));
    this.startBounds = unionAabb(this.items.map(furnitureBounds));
    this.obstacles = [
      ...axisAlignedWallBounds(floor),
      ...floor.furniture.filter((item) => !ids.has(item.id)).map(furnitureBounds),
    ];
  }

  get original(): readonly FurnitureItem[] {
    return this.items;
  }

  preview(delta: Vec2): Preview {
    const snapped = this.snapDelta(delta);
    const furniture = new Map(this.items.map((item) => [item.id, translateFurniture(item, snapped.delta)]));
    return { furniture, rooms: EMPTY_MAP, guideX: snapped.guideX, guideY: snapped.guideY };
  }

  private snapDelta(delta: Vec2): { delta: Vec2; guideX: number | null; guideY: number | null } {
    if (!this.snap.enabled || !this.startBounds) {
      return { delta, guideX: null, guideY: null };
    }
    const moved = translateAabb(this.startBounds, delta);
    const result = snapBounds(moved, snapTargetsFromBounds(this.obstacles), this.snap.threshold, this.snap.gridSize);
    return {
      delta: vec(delta.x + result.delta.x, delta.y + result.delta.y),
      guideX: result.guideX,
      guideY: result.guideY,
    };
  }
}

/** Moves a room together with the furniture standing inside it; glues walls to neighbouring rooms. */
export class RoomDragSession {
  readonly room: Room;
  readonly contained: readonly FurnitureItem[];
  private readonly others: readonly Room[];

  constructor(
    floor: Floor,
    roomId: EntityId,
    private readonly snap: SnapOptions,
  ) {
    const room = floor.rooms.find((entry) => entry.id === roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }
    this.room = room;
    this.contained = floor.furniture.filter((item) => roomContainsPoint(room, item));
    this.others = floor.rooms.filter((entry) => entry.id !== roomId);
  }

  preview(delta: Vec2): Preview {
    const snapped = this.snap.enabled
      ? snapRoomTranslation(this.room, delta, this.others, this.snap.threshold, this.snap.gridSize)
      : { delta, glued: [] };
    const room = translateRoom(this.room, snapped.delta);
    const furniture = new Map(this.contained.map((item) => [item.id, translateFurniture(item, snapped.delta)]));
    return { furniture, rooms: new Map([[room.id, room]]), guideX: null, guideY: null, glue: snapped.glued };
  }
}

/** Drags one corner of a room outline (optionally a corner that was just inserted on a wall). */
export class VertexDragSession {
  readonly before: Room;
  private readonly base: Room;
  private readonly others: readonly Room[];
  private readonly start: Vec2;

  constructor(
    floor: Floor,
    roomId: EntityId,
    private readonly index: number,
    private readonly snap: SnapOptions,
    insertOnWall: { wall: number; point: Vec2 } | null = null,
  ) {
    const room = floor.rooms.find((entry) => entry.id === roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }
    this.before = room;
    this.base = insertOnWall ? insertVertex(room, insertOnWall.wall, insertOnWall.point) : room;
    this.others = floor.rooms.filter((entry) => entry.id !== roomId);
    this.start = this.base.points[index];
  }

  /** Room after inserting the corner but before moving it. */
  get initial(): Room {
    return this.base;
  }

  preview(delta: Vec2): { preview: Preview; valid: boolean } {
    const raw = vec(this.start.x + delta.x, this.start.y + delta.y);
    const n = this.base.points.length;
    const neighbours = [this.base.points[(this.index - 1 + n) % n], this.base.points[(this.index + 1) % n]];
    const snapped = this.snap.enabled
      ? snapVertex(raw, {
          others: this.others,
          neighbours,
          threshold: this.snap.threshold,
          gridSize: this.snap.gridSize,
        })
      : { point: raw, guide: null };
    const room = moveVertex(this.base, this.index, snapped.point);
    const valid = isValidOutline(room.points);
    return {
      preview: {
        furniture: EMPTY_MAP,
        rooms: new Map([[room.id, room]]),
        guideX: null,
        guideY: null,
        glue: snapped.guide ? [snapped.guide] : [],
        invalidRoomId: valid ? null : room.id,
      },
      valid,
    };
  }
}

/** Minimum distance between two corners of an outline (cm). */
export const MIN_CORNER_DISTANCE = 10;

export function isValidOutline(points: readonly Vec2[]): boolean {
  const n = points.length;
  const cornersApart = points.every((p, i) => distanceBetween(p, points[(i + 1) % n]) >= MIN_CORNER_DISTANCE);
  return cornersApart && isSimplePolygon(points) && polygonArea(points) >= DIMENSION_LIMITS.minRoomLength ** 2;
}

/** Snaps a point while drawing a new room outline. */
export function snapDrawPoint(
  floor: Floor,
  point: Vec2,
  drawn: readonly Vec2[],
  snap: SnapOptions,
): { point: Vec2; guide: Segment | null } {
  if (!snap.enabled) {
    return { point, guide: null };
  }
  const first = drawn[0];
  if (first && drawn.length >= 3 && distanceBetween(first, point) <= snap.threshold * 1.5) {
    return { point: first, guide: null };
  }
  const last = drawn[drawn.length - 1];
  return snapVertex(point, {
    others: floor.rooms,
    neighbours: [last, first].filter((p): p is Vec2 => p !== undefined),
    threshold: snap.threshold,
    gridSize: snap.gridSize,
  });
}

/** Outline of a rectangle dragged with the draw tool (corners snapped like vertices). */
export function drawnRectangle(floor: Floor, start: Vec2, current: Vec2, snap: SnapOptions): Vec2[] {
  const a = snapDrawPoint(floor, start, [], snap).point;
  const b = snapDrawPoint(floor, current, [], snap).point;
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x, b.x);
  const maxY = Math.max(a.y, b.y);
  return [vec(minX, minY), vec(maxX, minY), vec(maxX, maxY), vec(minX, maxY)];
}

export function isValidRoomSize(points: readonly Vec2[]): boolean {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return (
    Math.max(...xs) - Math.min(...xs) >= DIMENSION_LIMITS.minRoomLength &&
    Math.max(...ys) - Math.min(...ys) >= DIMENSION_LIMITS.minRoomLength &&
    isValidOutline(points)
  );
}
