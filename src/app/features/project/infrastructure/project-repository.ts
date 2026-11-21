import { InjectionToken } from '@angular/core';
import { EntityId } from '../../../core/domain/id';
import { Project, ProjectSummary } from '../domain/model';
import { IndexedDbProjectRepository, isIndexedDbAvailable } from './indexeddb-project-repository';
import { LocalStorageProjectRepository } from './local-storage-project-repository';

/** Port for project persistence. */
export interface ProjectRepository {
  list(): Promise<ProjectSummary[]>;
  load(id: EntityId): Promise<Project | null>;
  save(project: Project): Promise<void>;
  delete(id: EntityId): Promise<void>;
}

export const PROJECT_REPOSITORY = new InjectionToken<ProjectRepository>('PROJECT_REPOSITORY', {
  providedIn: 'root',
  factory: () =>
    isIndexedDbAvailable()
      ? new IndexedDbProjectRepository()
      : new LocalStorageProjectRepository(globalThis.localStorage),
});
