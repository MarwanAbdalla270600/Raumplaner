import { inject, Injectable, signal } from '@angular/core';
import { createId, EntityId } from '../../../core/domain/id';
import { Project, ProjectSummary } from '../domain/model';
import { createProject, NewProjectNames } from '../domain/project-factory';
import { PROJECT_REPOSITORY } from '../infrastructure/project-repository';

/** Use cases for managing the list of projects (create, rename, delete, import). */
@Injectable({ providedIn: 'root' })
export class ProjectLibrary {
  private readonly repository = inject(PROJECT_REPOSITORY);
  readonly projects = signal<readonly ProjectSummary[]>([]);
  readonly loading = signal(false);

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      this.projects.set(await this.repository.list());
    } finally {
      this.loading.set(false);
    }
  }

  async create(names: NewProjectNames): Promise<Project> {
    const project = createProject(names);
    await this.repository.save(project);
    await this.refresh();
    return project;
  }

  async rename(id: EntityId, name: string): Promise<void> {
    const project = await this.repository.load(id);
    if (project && name.trim()) {
      await this.repository.save({ ...project, name: name.trim(), updatedAt: new Date().toISOString() });
      await this.refresh();
    }
  }

  async delete(id: EntityId): Promise<void> {
    await this.repository.delete(id);
    await this.refresh();
  }

  /** Imports a project; a fresh id avoids overwriting an existing project with the same id. */
  async import(project: Project): Promise<Project> {
    const imported = { ...project, id: createId('project'), updatedAt: new Date().toISOString() };
    await this.repository.save(imported);
    await this.refresh();
    return imported;
  }

  load(id: EntityId): Promise<Project | null> {
    return this.repository.load(id);
  }
}
