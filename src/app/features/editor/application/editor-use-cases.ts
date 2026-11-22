import { inject, Injectable } from '@angular/core';
import { CompositeCommand } from '../../../core/application/command';
import { distanceBetween, dot, Vec2, vec } from '../../../core/domain/geometry';
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
import { Floor, FurnitureItem, FurnitureSpec, Opening, OpeningKind, Room, WallIndex } from '../../project/domain/model';
import {
  createCustomFurniture,
  createFloor,
  createFurnitureItem,
  createOpening,
  createRoom,
} from '../../project/domain/project-factory';
import {
  clampOpening,
  moveRoomTo,
  pointsAttachedToWall,
  removeVertex,
  resizeRoom,
  roomCenter,
  roomOrigin,
  roomSize,
  translateRoom,
  wallEdges,
  wallLength,
  withClampedOpenings,
  withPoints,
} from '../../project/domain/room-geometry';
import { RoomShape, shapePoints } from '../../project/domain/room-shapes';
import { isValidOutline, MIN_CORNER_DISTANCE } from './drag-sessions';
import { findFreePosition } from '../domain/placement';
import { nextRoomPosition } from '../domain/room-placement';
import { rotateFurniture, translateFurniture } from '../domain/transform';
import { EditorState } from './editor-state';

export const DUPLICATE_OFFSET_CM = 20;

export type FurniturePatch = Partial<Omit<FurnitureItem, 'id' | 'catalogId'>>;
/** Room changes; x/y move the bounding box, width/depth scale the outline. */
export type RoomPatch = Partial<Omit<Room, 'id' | 'openings' | 'points'>> & {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly depth?: number;
};

export interface NewRoomInput {
  readonly name?: string;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly shape?: RoomShape;
  readonly x?: number;
  readonly y?: number;
}

/** Default depth of a room created with "attach room" (cm). */
export const ATTACHED_ROOM_DEPTH = 300;
const SHARED_WALL_COS = 0.999;
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
      if (room) this.replaceRoom(room, translateRoom(room, delta), 'command.moveRoom');
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

  addRoom(input: NewRoomInput): Room | null {
    const floor = this.store.activeFloor();
    if (!floor) {
      return null;
    }
    const position =
      input.x !== undefined && input.y !== undefined
        ? { x: input.x, y: input.y }
        : nextRoomPosition(floor.rooms, this.floorWallThickness());
    const width = clampLength(input.width, DIMENSION_LIMITS.minRoomLength);
    const depth = clampLength(input.depth, DIMENSION_LIMITS.minRoomLength);
    return this.addRoomWithPoints(
      shapePoints(input.shape ?? 'rectangle', width, depth, position.x, position.y),
      input.name,
      clampLength(input.height, DIMENSION_LIMITS.minRoomLength),
    );
  }

  /** Adds a room with a free outline (drawn on the plan). */
  addRoomWithPoints(points: readonly Vec2[], name?: string, height: number = ROOM_DEFAULTS.height): Room | null {
    const room = this.buildRoom(points, name, height);
    return room ? this.insertRoom(room) : null;
  }

  /** Wall thickness used for new rooms: the one of the existing rooms on the floor. */
  floorWallThickness(): number {
    return this.store.activeFloor()?.rooms[0]?.wallThickness ?? ROOM_DEFAULTS.wallThickness;
  }

  /** Sets the wall thickness of all rooms on the active floor (one undo step). 0 = no wall thickness. */
  setFloorWallThickness(thickness: number): void {
    const floor = this.store.activeFloor();
    const value = Math.min(DIMENSION_LIMITS.maxWallThickness, Math.max(0, thickness));
    const changed = floor?.rooms.filter((room) => room.wallThickness !== value) ?? [];
    if (!floor || changed.length === 0) {
      return;
    }
    this.store.execute(
      new CompositeCommand(
        'command.wallThickness',
        changed.map((room) => new UpdateRoomCommand(floor.id, room, { ...room, wallThickness: value })),
      ),
    );
  }

  /** Finishes the outline drawn point by point; returns null if it is not a valid room. */
  finishDraft(): Room | null {
    const draft = this.state.draft();
    this.state.draft.set(null);
    if (!draft) {
      return null;
    }
    const points = draft.points.filter(
      (point, index, all) => index === 0 || distanceBetween(point, all[index - 1]) >= MIN_CORNER_DISTANCE,
    );
    const closed =
      points.length > 3 && distanceBetween(points[0], points[points.length - 1]) < MIN_CORNER_DISTANCE
        ? points.slice(0, -1)
        : points;
    const room = closed.length >= 3 ? this.addRoomWithPoints(closed) : null;
    this.state.tool.set('select');
    return room;
  }

  cancelDraft(): void {
    this.state.draft.set(null);
  }

  removeLastDraftPoint(): void {
    this.state.draft.update((draft) => {
      if (!draft || draft.points.length <= 1) return null;
      return { ...draft, points: draft.points.slice(0, -1) };
    });
  }

  /** Creates a rectangular room that shares the given wall of an existing room, with a door in it. */
  attachRoom(roomId: EntityId, wall: WallIndex, depth = ATTACHED_ROOM_DEPTH): Room | null {
    const source = this.store.activeFloor()?.rooms.find((entry) => entry.id === roomId);
    const room = source
      ? this.buildRoom(pointsAttachedToWall(source, wall, depth), undefined, source.height, source.wallThickness)
      : null;
    if (!source || !room) {
      return null;
    }
    const sourceEdge = wallEdges(source)[wall];
    const shared = wallEdges(room).find(
      (edge) =>
        dot(edge.direction, sourceEdge.direction) < -SHARED_WALL_COS && Math.abs(edge.length - sourceEdge.length) < 1,
    );
    if (!shared) {
      return this.insertRoom(room);
    }
    const door = createOpening('door', shared.index, 0);
    return this.insertRoom({
      ...room,
      openings: [clampOpening(room, { ...door, offset: (shared.length - door.width) / 2 })],
    });
  }

  updateRoom(roomId: EntityId, patch: RoomPatch, label?: string): void {
    const before = this.store.activeFloor()?.rooms.find((room) => room.id === roomId);
    if (!before) {
      return;
    }
    const { x, y, width, depth, ...rest } = sanitizeRoomPatch(patch);
    let after: Room = { ...before, ...rest };
    if (width !== undefined || depth !== undefined) {
      const size = roomSize(after);
      after = resizeRoom(after, width ?? size.width, depth ?? size.depth);
    }
    if (x !== undefined || y !== undefined) {
      const origin = roomOrigin(after);
      after = moveRoomTo(after, x ?? origin.x, y ?? origin.y);
    }
    this.replaceRoom(before, withClampedOpenings(after), label);
  }

  /** Commits a changed outline (corner drag, inserted or removed corner). */
  commitRoomShape(before: Room, after: Room): void {
    if (isValidOutline(after.points) && after !== before) {
      this.replaceRoom(before, withPoints(after, after.points), 'command.reshapeRoom');
    }
  }

  setVertex(roomId: EntityId, index: number, point: Vec2): void {
    const room = this.store.activeFloor()?.rooms.find((entry) => entry.id === roomId);
    if (room) {
      this.commitRoomShape(room, { ...room, points: room.points.map((p, i) => (i === index ? point : p)) });
    }
  }

  removeVertex(roomId: EntityId, index: number): void {
    const room = this.store.activeFloor()?.rooms.find((entry) => entry.id === roomId);
    if (room && room.points.length > 3) {
      this.commitRoomShape(room, removeVertex(room, index));
    }
  }

  /** Commits a room drag (room and the furniture moved with it) as one undo step. */
  commitRoomMove(
    before: Room,
    after: Room,
    furnitureBefore: readonly FurnitureItem[],
    furnitureAfter: readonly FurnitureItem[],
  ): void {
    const floor = this.store.activeFloor();
    if (!floor || before.points === after.points) {
      return;
    }
    this.store.execute(
      new CompositeCommand('command.moveRoom', [
        new UpdateRoomCommand(floor.id, before, after),
        new UpdateFurnitureCommand(floor.id, furnitureBefore, furnitureAfter),
      ]),
    );
  }

  addOpening(roomId: EntityId, kind: OpeningKind, wall?: WallIndex): void {
    this.mutateOpenings(roomId, (room) => {
      const target = wall ?? this.freeWall(room, kind);
      const draft = createOpening(kind, target, 0);
      const centred = { ...draft, offset: (wallLength(room, target) - draft.width) / 2 };
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

  private replaceRoom(before: Room, after: Room, label?: string): void {
    const floor = this.store.activeFloor();
    if (floor && after !== before) {
      this.store.execute(new UpdateRoomCommand(floor.id, before, after, label));
    }
  }

  /** Longest wall without an opening of that kind (falls back to the longest wall). */
  private freeWall(room: Room, kind: OpeningKind): WallIndex {
    const edges = wallEdges(room).sort((a, b) => b.length - a.length);
    const used = new Set(room.openings.filter((o) => o.kind === kind).map((o) => o.wall));
    return (edges.find((edge) => !used.has(edge.index)) ?? edges[0]).index;
  }

  private buildRoom(
    points: readonly Vec2[],
    name: string | undefined,
    height: number,
    wallThickness = this.floorWallThickness(),
  ): Room | null {
    const floor = this.store.activeFloor();
    if (!floor || !isValidOutline(points)) {
      return null;
    }
    const draft = createRoom({
      name: name?.trim() || this.i18n.t('editor.newRoomName', { index: floor.rooms.length + 1 }),
      points,
      height,
      wallThickness,
    });
    return withPoints(draft, points);
  }

  private insertRoom(room: Room): Room | null {
    const floor = this.store.activeFloor();
    if (!floor) {
      return null;
    }
    this.execute(floor, (id) => new AddRoomCommand(id, room));
    this.state.selectRoom(room.id);
    return room;
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
