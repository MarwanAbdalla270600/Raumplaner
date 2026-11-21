import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { I18nService } from '../../../core/i18n/i18n.service';
import { AppPreferencesComponent } from '../../../core/presentation/app-preferences';
import {
  ButtonComponent,
  CardComponent,
  DialogComponent,
  IconComponent,
  TextFieldComponent,
  ToastService,
} from '../../../design-system/components';
import { ProjectLibrary } from '../application/project-library';
import { ProjectSummary } from '../domain/model';
import { ProjectFileService } from '../infrastructure/project-file.service';

type DialogState =
  | { readonly kind: 'create' }
  | { readonly kind: 'rename'; readonly project: ProjectSummary }
  | { readonly kind: 'delete'; readonly project: ProjectSummary };

@Component({
  selector: 'app-projects-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppPreferencesComponent,
    ButtonComponent,
    CardComponent,
    DialogComponent,
    IconComponent,
    RouterLink,
    TextFieldComponent,
  ],
  templateUrl: './projects-page.html',
  styleUrl: './projects-page.scss',
})
export class ProjectsPage implements OnInit {
  protected readonly i18n = inject(I18nService);
  protected readonly library = inject(ProjectLibrary);
  private readonly files = inject(ProjectFileService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly dialog = signal<DialogState | null>(null);
  protected readonly nameDraft = signal('');
  protected readonly deleteName = computed(() => {
    const state = this.dialog();
    return state?.kind === 'delete' ? state.project.name : '';
  });

  ngOnInit(): void {
    void this.library.refresh();
  }

  protected openCreate(): void {
    this.nameDraft.set(this.i18n.t('projects.defaultName'));
    this.dialog.set({ kind: 'create' });
  }

  protected openRename(project: ProjectSummary): void {
    this.nameDraft.set(project.name);
    this.dialog.set({ kind: 'rename', project });
  }

  protected openDelete(project: ProjectSummary): void {
    this.dialog.set({ kind: 'delete', project });
  }

  protected closeDialog(open: boolean): void {
    if (!open) this.dialog.set(null);
  }

  protected async confirm(): Promise<void> {
    const state = this.dialog();
    this.dialog.set(null);
    if (!state) {
      return;
    }
    if (state.kind === 'create') {
      const project = await this.library.create({
        projectName: this.nameDraft().trim() || this.i18n.t('projects.defaultName'),
        floorName: this.i18n.t('projects.defaultFloor'),
        roomName: this.i18n.t('projects.defaultRoom'),
      });
      this.toasts.show(this.i18n.t('projects.created'), 'success');
      await this.router.navigate(['/project', project.id]);
    } else if (state.kind === 'rename') {
      await this.library.rename(state.project.id, this.nameDraft());
    } else {
      await this.library.delete(state.project.id);
      this.toasts.show(this.i18n.t('projects.deleted'));
    }
  }

  protected async importFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    const result = await this.files.importFromFile(file);
    if (!result.ok) {
      this.toasts.show(this.i18n.t('projects.importFailed', { reason: result.errors.slice(0, 2).join('; ') }), 'error');
      return;
    }
    const project = await this.library.import(result.project);
    this.toasts.show(this.i18n.t('projects.imported'), 'success');
    await this.router.navigate(['/project', project.id]);
  }

  protected async exportProject(summary: ProjectSummary): Promise<void> {
    const project = await this.library.load(summary.id);
    if (project) this.files.exportToFile(project);
  }
}
