import { Floor, FurnitureItem, Project, Room } from '../features/project/domain/model';

export function furniture(overrides: Partial<FurnitureItem> = {}): FurnitureItem {
  return {
    id: 'item-1',
    catalogId: null,
    name: 'Box',
    category: 'other',
    x: 0,
    y: 0,
    width: 100,
    depth: 50,
    height: 80,
    rotation: 0,
    elevation: 0,
    layer: 1,
    color: '#888888',
    material: null,
    weight: null,
    ...overrides,
  };
}

export function room(overrides: Partial<Room> = {}): Room {
  return {
    id: 'room-1',
    name: 'Room',
    x: 0,
    y: 0,
    width: 400,
    depth: 300,
    height: 250,
    wallThickness: 10,
    floorColor: '#cccccc',
    wallColor: '#eeeeee',
    openings: [],
    ...overrides,
  };
}

export function floor(overrides: Partial<Floor> = {}): Floor {
  return { id: 'floor-1', name: 'EG', level: 0, rooms: [], furniture: [], ...overrides };
}

export function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    name: 'Test',
    schemaVersion: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    settings: { unit: 'cm', gridSize: 10, snapEnabled: true, showDimensions: true },
    floors: [floor()],
    customCatalog: [],
    ...overrides,
  };
}
