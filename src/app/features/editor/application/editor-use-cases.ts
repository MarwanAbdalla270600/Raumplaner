import { inject, Injectable } from '@angular/core';
import { CompositeCommand } from '../../../core/application/command';
import { Aabb, aabbHeight, aabbWidth, Vec2, vec } from '../../../core/domain/geometry';
import { createId, EntityId } from '../../../core/domain/id';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  AddCustomFurnitureCommand,
  AddFloorCommand,
  AddFurnitureCommand,
  AddRoomCommand,
  ProjectCommand,
  RemoveFloorCommand,
  RemoveFurnitureCommand,
  RemoveRoomCommand,
  RenameFloorCommand,
  UpdateFurnitureCommand,
  UpdateRoomCommand,
} from '../../project/application/commands';
import { ProjectStore } from '../../project/application/project-store';
import { DIMENSION_LIMITS, ROOM_DEFAULTS } from '../../project/domain/defaults';
import { maxLayer, minLayer } from '../../project/domain/furniture-geometry';
import { Floor, FurnitureItem, FurnitureSpec, Opening, OpeningKind, Room, WallSide } from '../../project/domain/model';
import {
  createCustomFurniture,
  createFloor,
  createFurnitureItem,
  createOpening,
  createRoom,
} from '../../project/domain/project-factory';
import { clampOpening, roomCenter, wallLength, withClampedOpenings } from '../../project/domain/room-geometry';
import { findFreePosition } from '../domain/placement';
import { nextRoomPosition } from '../domain/room-placement';
import { rotateFurniture, translateFurniture } from '../domain/transform';
import { EditorState } from './editor-state';

export const DUPLICATE_OFFSET_CM = 20;

export type FurniturePatch = Partial<Omit<FurnitureItem, 'id' | 'catalogId'>>;
export type RoomPatch = Partial<Omit<Room, 'id' | 'openings'>>;
export type OpeningPatch = Partial<Omit<Opening, 'id'>>;

const clampLength = (value: number, min: number = DIMENSION_LIMITS.minLength): number =>
  Math.min(DIMENSION_LIMITS.maxLength, Math.max(min, value));

function sanitizeFurniturePatch(patch: FurniturePatch): FurniturePatch {
  const result: { -readonly [K in keyof FurniturePatch]: FurniturePatch[K] } = { ...patch };
  if (result.width !== undefined) result.width = clampLength(result.width);
  if (result.depth !== undefined) result.depth = clampLength(result.depth);
  if (result.height !== undefined) result.height = clampLength(result.height);
  if (result.elevation !== undefined) result.elevation = Math.max(0, result.elevation);
  return result;
}

function sanitizeRoomPatch(patch: RoomPatch): RoomPatch {
  const result: { -readonly [K in keyof RoomPatch]: RoomPatch[K] } = { ...patch };
  if (result.width !== undefined) result.width = clampLength(result.width, DIMENSION_LIMITS.minRoomLength);
  if (result.depth !== undefined) result.depth = clampLength(result.depth, DIMENSION_LIMITS.minRoomLength);
  if (result.height !== undefined) result.height = clampLength(result.height, DIMENSION_LIMITS.minRoomLength);
  if (result.wallThickness !== undefined)
    result.wallThickness = Math.min(DIMENSION_LIMITS.maxWallThickness, Math.max(0, result.wallThickness));
  return result;
}

/**
 * Application use cases of the editor. Each method translates a user intention into exactly
 * one command (= one undo step) and updates the selection where it makes sense.
 */
@Injectable()
export class EditorUseCases {
  private readonly store = inject(ProjectStore);
  private readonly state = inject(EditorState);
  private readonly i18n = inject(I18nService);

  // ── Furniture ────────────────────────────────────────────────────────────

  placeFurniture(spec: FurnitureSpec, catalogId: string | null, position?: Vec2): FurnitureItem | null {
    const floor = this.store.activeFloor();
    if (!floor) {
      return null;
    }
    const draft = createFurnitureItem(
      spec,
      position ?? this.defaultPlacement(floor),
      catalogId,
      maxLayer(floor.furniture) + 1,
    );
    const item = { ...draft, ...findFreePosition(floor, draft, draft) };
    this.execute(floor, (id) => new AddFurnitureCommand(id, [item]));
    this.state.selectFurniture([item.id]);
    return item;
  }

  deleteSelection(): void {
    const floor = this.store.activeFloor();
    const project = this.store.project();
    const selection = this.state.selection();
    if (!floor || !project) {
      return;
    }
    if (selection.kind === 'furniture') {
      this.store.execute(new RemoveFurnitureCommand(project, floor.id, selection.ids));
    } else if (selection.kind === 'room') {
      this.store.execute(new RemoveRoomCommand(project, floor.id, selection.id));
    }
    this.state.clearSelection();
  }

  duplicateSelection(): void {
    const floor = this.store.activeFloor();
    const items = this.state.selectedFurniture();
    if (!floor || items.length === 0) {
      return;
    }
    const layer = maxLayer(floor.furniture);
    const copies = items.map((item, index) => ({
      ...translateFurniture(item, vec(DUPLICATE_OFFSET_CM, DUPLICATE_OFFSET_CM)),
      id: createId('item'),
      layer: layer + index + 1,
    }));
    this.execute(floor, (id) => new AddFurnitureCommand(id, copies));
    this.state.selectFurniture(copies.map((copy) => copy.id));
  }

  rotateSelection(degrees: number): void {
    this.transformSelection((item) => rotateFurniture(item, degrees), 'command.rotateFurniture');
  }

  nudgeSelection(delta: Vec2): void {
    if (this.state.selection().kind === 'room') {
      const room = this.state.selectedRoom();
      if (room) this.updateRoom(room.id, { x: room.x + delta.x, y: room.y + delta.y }, 'command.moveRoom');
      return;
    }
    this.transformSelection((item) => translateFurniture(item, delta), 'command.moveFurniture');
  }

  updateFurniture(ids: Iterable<EntityId>, patch: FurniturePatch): void {
    const idSet = new Set(ids);
    const floor = this.store.activeFloor();
    const before = floor?.furniture.filter((item) => idSet.has(item.id)) ?? [];
    const clean = sanitizeFurniturePatch(patch);
    const after = before.map((item) => ({ ...item, ...clean }));
    if (floor && before.length > 0) {
      this.store.execute(new UpdateFurnitureCommand(floor.id, before, after));
    }
  }

  /** Commits the result of a drag gesture as a single undo step. */
  commitFurnitureChange(before: readonly FurnitureItem[], after: readonly FurnitureItem[], label: string): void {
    const floor = this.store.activeFloor();
    const changed = after.some((item, index) => item !== before[index]);
    if (floor && changed) {
      this.store.execute(new UpdateFurnitureCommand(floor.id, before, after, label));
    }
  }

  bringForward(): void {
    const floor = this.store.activeFloor();
    if (floor) this.transformSelection((item) => ({ ...item, layer: maxLayer(floor.furniture) + 1 }));
  }

  sendBackward(): void {
    const floor = this.store.activeFloor();
    if (floor) this.transformSelection((item) => ({ ...item, layer: minLayer(floor.furniture) - 1 }));
  }

  selectAll(): void {
    this.state.selectFurniture(this.store.activeFloor()?.furniture.map((item) => item.id) ?? []);
  }

  createCustomFurniture(spec: FurnitureSpec): void {
    const definition = createCustomFurniture(spec);
    this.store.execute(new AddCustomFurnitureCommand(definition));
  }

  // ── Rooms & openings ────────────────────────────────────────────────────

  addRoom(input: { name?: string; width: number; depth: number; height: number; x?: number; y?: number }): Room | null {
    const floor = this.store.activeFloor();
    if (!floor) {
      return null;
    }
    const position =
      input.x !== undefined && input.y !== undefined
        ? { x: input.x, y: input.y }
        : nextRoomPosition(floor.rooms, ROOM_DEFAULTS.wallThickness);
    const room = createRoom({
      name: input.name?.trim() || this.i18n.t('editor.newRoomName', { index: floor.rooms.length + 1 }),
      ...position,
      width: clampLength(input.width, DIMENSION_LIMITS.minRoomLength),
      depth: clampLength(input.depth, DIMENSION_LIMITS.minRoomLength),
      height: clampLength(input.height, DIMENSION_LIMITS.minRoomLength),
    });
    this.execute(floor, (id) => new AddRoomCommand(id, room));
    this.state.selectRoom(room.id);
    return room;
  }

  addRoomFromBounds(bounds: Aabb): Room | null {
    return this.addRoom({
      x: bounds.minX,
      y: bounds.minY,
      width: aabbWidth(bounds),
      depth: aabbHeight(bounds),
      height: ROOM_DEFAULTS.height,
    });
  }

  updateRoom(roomId: EntityId, patch: RoomPatch, label?: string): void {
    const floor = this.store.activeFloor();
    const before = floor?.rooms.find((room) => room.id === roomId);
    if (!floor || !before) {
      return;
    }
    const after = withClampedOpenings({ ...before, ...sanitizeRoomPatch(patch) });
    this.store.execute(new UpdateRoomCommand(floor.id, before, after, label));
  }

  /** Commits a room drag (room and the furniture moved with it) as one undo step. */
  commitRoomMove(
    before: Room,
    after: Room,
    furnitureBefore: readonly FurnitureItem[],
    furnitureAfter: readonly FurnitureItem[],
  ): void {
    const floor = this.store.activeFloor();
    if (!floor || (before.x === after.x && before.y === after.y)) {
      return;
    }
    this.store.execute(
      new CompositeCommand('command.moveRoom', [
        new UpdateRoomCommand(floor.id, before, after),
        new UpdateFurnitureCommand(floor.id, furnitureBefore, furnitureAfter),
      ]),
    );
  }

  addOpening(roomId: EntityId, kind: OpeningKind, wall: WallSide = 'south'): void {
    this.mutateOpenings(roomId, (room) => {
      const draft = createOpening(kind, wall, 0);
      const centred = { ...draft, offset: (wallLength(room, wall) - draft.width) / 2 };
      return [...room.openings, clampOpening(room, centred)];
    });
  }

  updateOpening(roomId: EntityId, openingId: EntityId, patch: OpeningPatch): void {
    this.mutateOpenings(roomId, (room) =>
      room.openings.map((opening) =>
        opening.id === openingId ? clampOpening(room, { ...opening, ...patch }) : opening,
      ),
    );
  }

  removeOpening(roomId: EntityId, openingId: EntityId): void {
    this.mutateOpenings(roomId, (room) => room.openings.filter((opening) => opening.id !== openingId));
  }

  // ── Floors ──────────────────────────────────────────────────────────────

  addFloor(): void {
    const floors = this.store.floors();
    const level = floors.reduce((max, floor) => Math.max(max, floor.level), -1) + 1;
    const floor = createFloor(this.i18n.t('editor.floorName', { level }), level);
    this.store.execute(new AddFloorCommand(floor));
    this.store.selectFloor(floor.id);
    this.state.clearSelection();
  }

  removeActiveFloor(): void {
    const project = this.store.project();
    const floor = this.store.activeFloor();
    if (project && floor && project.floors.length > 1) {
      this.store.execute(new RemoveFloorCommand(project, floor.id));
      this.state.clearSelection();
    }
  }

  renameActiveFloor(name: string): void {
    const floor = this.store.activeFloor();
    if (floor && name.trim() && name !== floor.name) {
      this.store.execute(new RenameFloorCommand(floor.id, floor.name, name.trim()));
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private transformSelection(transform: (item: FurnitureItem) => FurnitureItem, label?: string): void {
    const floor = this.store.activeFloor();
    const before = this.state.selectedFurniture();
    if (floor && before.length > 0) {
      this.store.execute(new UpdateFurnitureCommand(floor.id, before, before.map(transform), label));
    }
  }

  private mutateOpenings(roomId: EntityId, mutate: (room: Room) => readonly Opening[]): void {
    const floor = this.store.activeFloor();
    const before = floor?.rooms.find((room) => room.id === roomId);
    if (floor && before) {
      this.store.execute(new UpdateRoomCommand(floor.id, before, { ...before, openings: mutate(before) }));
    }
  }

  private execute(floor: Floor, build: (floorId: EntityId) => ProjectCommand): void {
    this.store.execute(build(floor.id));
  }

  private defaultPlacement(floor: Floor): Vec2 {
    const selectedRoom = this.state.selectedRoom();
    const room = selectedRoom ?? floor.rooms[0];
    return room ? roomCenter(room) : vec(0, 0);
  }
}
