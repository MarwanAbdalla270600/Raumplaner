import { DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { PROJECT_REPOSITORY } from '../infrastructure/project-repository';
import { ProjectStore } from './project-store';

export const AUTOSAVE_DELAY_MS = 500;

export type SaveStatus = 'idle' | 'pending' | 'saved' | 'error';

/**
 * The only place where project changes trigger I/O. Provided per editor page, so autosave
 * is active exactly while a project is open.
 */
@Injectable()
export class AutosaveService {
  private readonly store = inject(ProjectStore);
  private readonly repository = inject(PROJECT_REPOSITORY);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastSavedAt: string | null = null;

  readonly status = signal<SaveStatus>('idle');

  constructor() {
    effect(() => {
      const project = this.store.project();
      if (project && project.updatedAt !== this.lastSavedAt) {
        this.schedule();
      }
    });
    inject(DestroyRef).onDestroy(() => this.flush());
  }

  /** Saves immediately (e.g. before leaving the page). */
  async flush(): Promise<void> {
    this.clearTimer();
    const project = this.store.project();
    if (!project || project.updatedAt === this.lastSavedAt) {
      return;
    }
    try {
      await this.repository.save(project);
      this.lastSavedAt = project.updatedAt;
      this.status.set('saved');
    } catch {
      this.status.set('error');
    }
  }

  private schedule(): void {
    this.clearTimer();
    this.status.set('pending');
    this.timer = setTimeout(() => void this.flush(), AUTOSAVE_DELAY_MS);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
