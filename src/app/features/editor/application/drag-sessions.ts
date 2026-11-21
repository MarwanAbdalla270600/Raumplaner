import {
  Aabb,
  aabbFromCorners,
  aabbHeight,
  aabbWidth,
  translateAabb,
  unionAabb,
  Vec2,
  vec,
} from '../../../core/domain/geometry';
import { EntityId } from '../../../core/domain/id';
import { furnitureBounds } from '../../project/domain/furniture-geometry';
import { Floor, FurnitureItem, Room } from '../../project/domain/model';
import { roomContainsPoint, roomInnerBounds, roomOuterBounds, wallRects } from '../../project/domain/room-geometry';
import { DIMENSION_LIMITS } from '../../project/domain/defaults';
import { mergeSnapTargets, snapAxis, snapBounds, snapTargetsFromBounds, snapToGrid } from '../domain/snapping';
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
      ...floor.rooms.flatMap(wallRects),
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

/** Moves a room together with the furniture standing inside it; snaps walls to neighbouring rooms. */
export class RoomDragSession {
  readonly room: Room;
  readonly contained: readonly FurnitureItem[];
  private readonly targets: { xs: number[]; ys: number[] };

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
    const others = floor.rooms.filter((entry) => entry.id !== roomId);
    const boxes = [...others.map(roomInnerBounds), ...others.map(roomOuterBounds)];
    const targets = mergeSnapTargets(snapTargetsFromBounds(boxes));
    this.targets = { xs: [...targets.xs], ys: [...targets.ys] };
  }

  preview(delta: Vec2): Preview {
    const snapped = this.snapDelta(delta);
    const room = { ...this.room, x: this.room.x + snapped.x, y: this.room.y + snapped.y };
    const furniture = new Map(this.contained.map((item) => [item.id, translateFurniture(item, snapped)]));
    return { furniture, rooms: new Map([[room.id, room]]), guideX: null, guideY: null };
  }

  private snapDelta(delta: Vec2): Vec2 {
    if (!this.snap.enabled) {
      return delta;
    }
    const inner = translateAabb(roomInnerBounds(this.room), delta);
    const outer = translateAabb(roomOuterBounds(this.room), delta);
    const x = snapAxis([inner.minX, inner.maxX, outer.minX, outer.maxX], this.targets.xs, this.snap.threshold);
    const y = snapAxis([inner.minY, inner.maxY, outer.minY, outer.maxY], this.targets.ys, this.snap.threshold);
    const gridX = x.target === null ? snapToGrid(inner.minX, this.snap.gridSize) - inner.minX : x.correction;
    const gridY = y.target === null ? snapToGrid(inner.minY, this.snap.gridSize) - inner.minY : y.correction;
    return vec(delta.x + gridX, delta.y + gridY);
  }
}

/** Rectangle being drawn with the "draw room" tool. */
export function drawnRoomBounds(start: Vec2, current: Vec2, snap: SnapOptions): Aabb {
  const snapPoint = (p: Vec2): Vec2 =>
    snap.enabled ? vec(snapToGrid(p.x, snap.gridSize), snapToGrid(p.y, snap.gridSize)) : p;
  return aabbFromCorners(snapPoint(start), snapPoint(current));
}

export function isValidRoomSize(bounds: Aabb): boolean {
  return aabbWidth(bounds) >= DIMENSION_LIMITS.minRoomLength && aabbHeight(bounds) >= DIMENSION_LIMITS.minRoomLength;
}
