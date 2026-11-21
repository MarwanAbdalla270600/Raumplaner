import { EntityId } from '../../../core/domain/id';
import { summarizeProject } from '../domain/project-factory';
import { parseProjectData } from '../domain/project-document';
import { Project, ProjectSummary } from '../domain/model';
import type { ProjectRepository } from './project-repository';

const KEY_PREFIX = 'raumplaner.project.';

/** Fallback repository for browsers without IndexedDB (e.g. some private modes). */
export class LocalStorageProjectRepository implements ProjectRepository {
  constructor(private readonly storage: Storage) {}

  async list(): Promise<ProjectSummary[]> {
    const projects = this.keys()
      .map((key) => this.read(key))
      .filter((project): project is Project => project !== null);
    return projects.map(summarizeProject).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async load(id: EntityId): Promise<Project | null> {
    return this.read(KEY_PREFIX + id);
  }

  async save(project: Project): Promise<void> {
    this.storage.setItem(KEY_PREFIX + project.id, JSON.stringify(project));
  }

  async delete(id: EntityId): Promise<void> {
    this.storage.removeItem(KEY_PREFIX + id);
  }

  private keys(): string[] {
    return Array.from({ length: this.storage.length }, (_, index) => this.storage.key(index)).filter(
      (key): key is string => key?.startsWith(KEY_PREFIX) ?? false,
    );
  }

  private read(key: string): Project | null {
    const raw = this.storage.getItem(key);
    if (!raw) {
      return null;
    }
    try {
      const result = parseProjectData(JSON.parse(raw) as Record<string, unknown>);
      return result.ok ? result.project : null;
    } catch {
      return null;
    }
  }
}
