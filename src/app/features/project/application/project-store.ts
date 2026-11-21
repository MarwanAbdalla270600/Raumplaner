import { computed, Injectable, signal } from '@angular/core';
import {
  canRedo,
  canUndo,
  CommandHistory,
  emptyHistory,
  executeCommand,
  redoCommand,
  undoCommand,
} from '../../../core/application/command-history';
import { EntityId } from '../../../core/domain/id';
import { Floor, Project, ProjectSettings } from '../domain/model';
import { ProjectCommand } from './commands';

/**
 * Single source of truth for the project being edited. All domain changes go through
 * `execute()` so that they are undoable. Settings and the project name are not part of the
 * undo history on purpose (they are preferences, not planning steps).
 */
@Injectable({ providedIn: 'root' })
export class ProjectStore {
  private readonly projectState = signal<Project | null>(null);
  private readonly historyState = signal<CommandHistory<Project>>(emptyHistory());
  private readonly activeFloorIdState = signal<EntityId | null>(null);

  readonly project = this.projectState.asReadonly();
  readonly history = this.historyState.asReadonly();
  readonly canUndo = computed(() => canUndo(this.historyState()));
  readonly canRedo = computed(() => canRedo(this.historyState()));
  readonly settings = computed(() => this.projectState()?.settings ?? null);
  readonly floors = computed<readonly Floor[]>(() => this.projectState()?.floors ?? []);

  readonly activeFloor = computed<Floor | null>(() => {
    const floors = this.floors();
    return floors.find((floor) => floor.id === this.activeFloorIdState()) ?? floors[0] ?? null;
  });

  load(project: Project): void {
    this.projectState.set(project);
    this.historyState.set(emptyHistory());
    this.activeFloorIdState.set(project.floors[0]?.id ?? null);
  }

  close(): void {
    this.projectState.set(null);
    this.historyState.set(emptyHistory());
    this.activeFloorIdState.set(null);
  }

  selectFloor(floorId: EntityId): void {
    this.activeFloorIdState.set(floorId);
  }

  execute(command: ProjectCommand): void {
    const project = this.projectState();
    if (!project) {
      return;
    }
    const transition = executeCommand(project, this.historyState(), command);
    this.commit(transition.state);
    this.historyState.set(transition.history);
  }

  undo(): void {
    this.step(undoCommand);
  }

  redo(): void {
    this.step(redoCommand);
  }

  updateSettings(settings: Partial<ProjectSettings>): void {
    const project = this.projectState();
    if (project) {
      this.commit({ ...project, settings: { ...project.settings, ...settings } });
    }
  }

  rename(name: string): void {
    const project = this.projectState();
    if (project && name.trim()) {
      this.commit({ ...project, name: name.trim() });
    }
  }

  private step(
    operation: (
      state: Project,
      history: CommandHistory<Project>,
    ) => { state: Project; history: CommandHistory<Project> },
  ): void {
    const project = this.projectState();
    if (!project) {
      return;
    }
    const transition = operation(project, this.historyState());
    this.commit(transition.state);
    this.historyState.set(transition.history);
  }

  private commit(project: Project): void {
    this.projectState.set({ ...project, updatedAt: new Date().toISOString() });
    if (!project.floors.some((floor) => floor.id === this.activeFloorIdState())) {
      this.activeFloorIdState.set(project.floors[0]?.id ?? null);
    }
  }
}
