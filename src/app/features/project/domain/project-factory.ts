import { createId, EntityId } from '../../../core/domain/id';
import { DOOR_DEFAULTS, ROOM_DEFAULTS, SETTINGS_DEFAULTS, WINDOW_DEFAULTS } from './defaults';
import {
  CURRENT_SCHEMA_VERSION,
  CustomFurnitureDefinition,
  Floor,
  FurnitureItem,
  FurnitureSpec,
  Opening,
  OpeningKind,
  Project,
  Room,
  WallSide,
} from './model';

export interface RoomInput {
  readonly name: string;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly depth?: number;
  readonly height?: number;
}

export function createRoom(input: RoomInput): Room {
  return {
    id: createId('room'),
    name: input.name,
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: input.width ?? ROOM_DEFAULTS.width,
    depth: input.depth ?? ROOM_DEFAULTS.depth,
    height: input.height ?? ROOM_DEFAULTS.height,
    wallThickness: ROOM_DEFAULTS.wallThickness,
    floorColor: ROOM_DEFAULTS.floorColor,
    wallColor: ROOM_DEFAULTS.wallColor,
    openings: [],
  };
}

export function createOpening(kind: OpeningKind, wall: WallSide, offset: number): Opening {
  const defaults = kind === 'door' ? DOOR_DEFAULTS : WINDOW_DEFAULTS;
  return { id: createId(kind), kind, wall, offset, ...defaults };
}

export function createFloor(name: string, level: number, rooms: readonly Room[] = []): Floor {
  return { id: createId('floor'), name, level, rooms, furniture: [] };
}

export function createFurnitureItem(
  spec: FurnitureSpec,
  position: { x: number; y: number },
  catalogId: string | null,
  layer: number,
): FurnitureItem {
  return {
    ...spec,
    id: createId('item'),
    catalogId,
    x: position.x,
    y: position.y,
    rotation: 0,
    elevation: 0,
    layer,
  };
}

export function createCustomFurniture(spec: FurnitureSpec): CustomFurnitureDefinition {
  return { ...spec, id: createId('custom') };
}

export interface NewProjectNames {
  readonly projectName: string;
  readonly floorName: string;
  readonly roomName: string;
}

export function createProject(names: NewProjectNames, now: Date = new Date(), id?: EntityId): Project {
  const timestamp = now.toISOString();
  const room = createRoom({ name: names.roomName });
  return {
    id: id ?? createId('project'),
    name: names.projectName,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    settings: { ...SETTINGS_DEFAULTS },
    floors: [createFloor(names.floorName, 0, [room])],
    customCatalog: [],
  };
}

export function summarizeProject(project: Project): {
  id: EntityId;
  name: string;
  updatedAt: string;
  roomCount: number;
  furnitureCount: number;
} {
  return {
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    roomCount: project.floors.reduce((sum, floor) => sum + floor.rooms.length, 0),
    furnitureCount: project.floors.reduce((sum, floor) => sum + floor.furniture.length, 0),
  };
}
