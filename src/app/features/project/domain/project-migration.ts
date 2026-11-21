import { CURRENT_SCHEMA_VERSION } from './model';

/** A migration lifts raw data from version `from` to `from + 1`. */
type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * Registry of schema migrations. When the model changes, bump CURRENT_SCHEMA_VERSION and
 * add an entry here, e.g. `1: (data) => ({ ...data, newField: default })`.
 */
const MIGRATIONS: Readonly<Record<number, Migration>> = {};

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
