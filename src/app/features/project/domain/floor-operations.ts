import { EntityId } from '../../../core/domain/id';
import { Floor, FurnitureItem, Project, Room } from './model';

export function findFloor(project: Project, floorId: EntityId): Floor | undefined {
  return project.floors.find((floor) => floor.id === floorId);
}

export function updateFloor(project: Project, floorId: EntityId, update: (floor: Floor) => Floor): Project {
  return { ...project, floors: project.floors.map((floor) => (floor.id === floorId ? update(floor) : floor)) };
}

function replaceById<T extends { id: EntityId }>(list: readonly T[], replacements: readonly T[]): T[] {
  const byId = new Map(replacements.map((entry) => [entry.id, entry]));
  return list.map((entry) => byId.get(entry.id) ?? entry);
}

export interface IndexedEntity<T> {
  readonly index: number;
  readonly entity: T;
}

/** Inserts entities at their remembered positions (used to restore deleted entities). */
export function insertAtIndices<T>(list: readonly T[], entries: readonly IndexedEntity<T>[]): T[] {
  const result = [...list];
  [...entries]
    .sort((a, b) => a.index - b.index)
    .forEach(({ index, entity }) => result.splice(Math.min(index, result.length), 0, entity));
  return result;
}

export function indexEntities<T extends { id: EntityId }>(
  list: readonly T[],
  ids: ReadonlySet<EntityId>,
): IndexedEntity<T>[] {
  return list.flatMap((entity, index) => (ids.has(entity.id) ? [{ index, entity }] : []));
}

export const furnitureOps = {
  add: (floor: Floor, items: readonly FurnitureItem[]): Floor => ({
    ...floor,
    furniture: [...floor.furniture, ...items],
  }),
  remove: (floor: Floor, ids: ReadonlySet<EntityId>): Floor => ({
    ...floor,
    furniture: floor.furniture.filter((item) => !ids.has(item.id)),
  }),
  replace: (floor: Floor, items: readonly FurnitureItem[]): Floor => ({
    ...floor,
    furniture: replaceById(floor.furniture, items),
  }),
  insert: (floor: Floor, entries: readonly IndexedEntity<FurnitureItem>[]): Floor => ({
    ...floor,
    furniture: insertAtIndices(floor.furniture, entries),
  }),
};

export const roomOps = {
  add: (floor: Floor, rooms: readonly Room[]): Floor => ({ ...floor, rooms: [...floor.rooms, ...rooms] }),
  remove: (floor: Floor, ids: ReadonlySet<EntityId>): Floor => ({
    ...floor,
    rooms: floor.rooms.filter((room) => !ids.has(room.id)),
  }),
  replace: (floor: Floor, rooms: readonly Room[]): Floor => ({ ...floor, rooms: replaceById(floor.rooms, rooms) }),
  insert: (floor: Floor, entries: readonly IndexedEntity<Room>[]): Floor => ({
    ...floor,
    rooms: insertAtIndices(floor.rooms, entries),
  }),
};
