import { migrateProjectData } from './project-migration';
import { validateProject, ValidationErrors } from './project-validation';
import { CURRENT_SCHEMA_VERSION, Project } from './model';

export const PROJECT_DOCUMENT_FORMAT = 'raumplaner.project';

/** Envelope used for JSON export/import. */
export interface ProjectDocument {
  readonly format: typeof PROJECT_DOCUMENT_FORMAT;
  readonly schemaVersion: number;
  readonly exportedAt: string;
  readonly project: Project;
}

export type ParseResult = { ok: true; project: Project } | { ok: false; errors: ValidationErrors };

export function toProjectDocument(project: Project, now: Date = new Date()): ProjectDocument {
  return {
    format: PROJECT_DOCUMENT_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    project,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseProjectDocument(json: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, errors: ['document: invalid JSON'] };
  }
  if (!isRecord(data) || data['format'] !== PROJECT_DOCUMENT_FORMAT) {
    return { ok: false, errors: [`document.format: "${PROJECT_DOCUMENT_FORMAT}" expected`] };
  }
  const project = data['project'];
  if (!isRecord(project)) {
    return { ok: false, errors: ['document.project: object expected'] };
  }
  return parseProjectData({ ...project, schemaVersion: data['schemaVersion'] ?? project['schemaVersion'] });
}

/** Migrates and validates raw (stored or imported) project data. */
export function parseProjectData(data: Record<string, unknown>): ParseResult {
  let migrated: Record<string, unknown>;
  try {
    migrated = migrateProjectData(data);
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)] };
  }
  const errors = validateProject(migrated);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, project: migrated as unknown as Project };
}
