import { EntityId } from '../../../core/domain/id';
import { summarizeProject } from '../domain/project-factory';
import { parseProjectData } from '../domain/project-document';
import { Project, ProjectSummary } from '../domain/model';
import type { ProjectRepository } from './project-repository';

const DATABASE_NAME = 'raumplaner';
const DATABASE_VERSION = 1;
const STORE_NAME = 'projects';

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class IndexedDbProjectRepository implements ProjectRepository {
  private database: Promise<IDBDatabase> | null = null;

  async list(): Promise<ProjectSummary[]> {
    const store = await this.store('readonly');
    const records = (await promisify(store.getAll())) as Record<string, unknown>[];
    return records
      .map((record) => parseProjectData(record))
      .flatMap((result) => (result.ok ? [summarizeProject(result.project)] : []))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async load(id: EntityId): Promise<Project | null> {
    const store = await this.store('readonly');
    const record = (await promisify(store.get(id))) as Record<string, unknown> | undefined;
    if (!record) {
      return null;
    }
    const result = parseProjectData(record);
    return result.ok ? result.project : null;
  }

  async save(project: Project): Promise<void> {
    const store = await this.store('readwrite');
    await promisify(store.put(project));
  }

  async delete(id: EntityId): Promise<void> {
    const store = await this.store('readwrite');
    await promisify(store.delete(id));
  }

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const database = await this.open();
    return database.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  }

  private open(): Promise<IDBDatabase> {
    this.database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.database;
  }
}
