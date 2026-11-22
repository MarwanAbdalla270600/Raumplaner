import { CURRENT_SCHEMA_VERSION } from './model';

/** A migration lifts raw data from version `from` to `from + 1`. */
type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * Registry of schema migrations. When the model changes, bump CURRENT_SCHEMA_VERSION and
 * add an entry here, e.g. `1: (data) => ({ ...data, newField: default })`.
 */
const MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: migrateRectangularRooms,
};

type RawRecord = Record<string, unknown>;
const WALL_INDEX_V1: Readonly<Record<string, number>> = { north: 0, east: 1, south: 2, west: 3 };
const asRecords = (value: unknown): RawRecord[] => (Array.isArray(value) ? (value as RawRecord[]) : []);
const num = (value: unknown): number => (typeof value === 'number' ? value : 0);

/**
 * v1 → v2: rooms were rectangles (x, y, width, depth) with openings on north/east/south/west.
 * They become polygons; south and west walls now run in the opposite direction (clockwise),
 * so their offsets are mirrored.
 */
function migrateRectangularRooms(data: RawRecord): RawRecord {
  const migrateRoom = (room: RawRecord): RawRecord => {
    const { x, y, width, depth, ...rest } = room;
    const [rx, ry, w, d] = [num(x), num(y), num(width), num(depth)];
    const points = [
      { x: rx, y: ry },
      { x: rx + w, y: ry },
      { x: rx + w, y: ry + d },
      { x: rx, y: ry + d },
    ];
    const openings = asRecords(room['openings']).map((opening) => {
      const side = String(opening['wall']);
      const wall = WALL_INDEX_V1[side] ?? 0;
      const length = wall % 2 === 0 ? w : d;
      const mirrored = side === 'south' || side === 'west';
      const offset = mirrored ? length - num(opening['offset']) - num(opening['width']) : num(opening['offset']);
      return { ...opening, wall, offset: Math.max(0, offset) };
    });
    return { ...rest, points, openings };
  };
  return {
    ...data,
    floors: asRecords(data['floors']).map((floor) => ({
      ...floor,
      rooms: asRecords(floor['rooms']).map(migrateRoom),
    })),
  };
}

export class UnsupportedSchemaVersionError extends Error {
  constructor(readonly version: number) {
    super(`Unsupported schema version ${version}`);
  }
}

export function migrateProjectData(data: Record<string, unknown>): Record<string, unknown> {
  const raw = data['schemaVersion'];
  let version = typeof raw === 'number' ? raw : 1;
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersionError(version);
  }
  let migrated = { ...data };
  while (version < CURRENT_SCHEMA_VERSION) {
    const migration = MIGRATIONS[version];
    if (!migration) {
      throw new UnsupportedSchemaVersionError(version);
    }
    migrated = migration(migrated);
    version += 1;
  }
  return { ...migrated, schemaVersion: CURRENT_SCHEMA_VERSION };
}
