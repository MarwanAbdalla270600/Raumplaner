import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { vec } from '../../../core/domain/geometry';
import { I18nService } from '../../../core/i18n/i18n.service';
import { BreakpointService } from '../../../core/layout/breakpoint.service';
import { BottomSheetComponent, IconComponent, TabsComponent, ToastService } from '../../../design-system/components';
import { CatalogPanelComponent } from '../../catalog/presentation/catalog-panel';
import { CatalogItem } from '../../catalog/domain/catalog-item';
import { AutosaveService } from '../../project/application/autosave.service';
import { ProjectLibrary } from '../../project/application/project-library';
import { ProjectStore } from '../../project/application/project-store';
import { FurnitureSpec } from '../../project/domain/model';
import { ProjectFileService } from '../../project/infrastructure/project-file.service';
import { Viewer3dComponent } from '../../viewer-3d/presentation/viewer-3d';
import { EditorState } from '../application/editor-state';
import { EditorUseCases } from '../application/editor-use-cases';
import { EditorAction, isTextInputTarget, resolveShortcut } from '../domain/shortcuts';
import { screenToWorld } from '../domain/viewport';
import { AddRoomDialogComponent, RoomFormValue } from './add-room-dialog';
import { EditorToolbarComponent } from './editor-toolbar';
import { FloorPlanComponent } from './floor-plan/floor-plan';
import { PropertiesPanelComponent } from './properties-panel';

type PanelTab = 'catalog' | 'properties';

@Component({
  selector: 'app-editor-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [EditorState, EditorUseCases, AutosaveService],
  imports: [
    AddRoomDialogComponent,
    BottomSheetComponent,
    CatalogPanelComponent,
    EditorToolbarComponent,
    FloorPlanComponent,
    IconComponent,
    NgTemplateOutlet,
    PropertiesPanelComponent,
    TabsComponent,
    Viewer3dComponent,
  ],
  host: { '(document:keydown)': 'onKeydown($event)' },
  templateUrl: './editor-page.html',
  styleUrl: './editor-page.scss',
})
export class EditorPage {
  /** Route parameter (bound via withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly i18n = inject(I18nService);
  protected readonly store = inject(ProjectStore);
  protected readonly state = inject(EditorState);
  protected readonly useCases = inject(EditorUseCases);
  protected readonly autosave = inject(AutosaveService);
  protected readonly breakpoints = inject(BreakpointService);
  private readonly library = inject(ProjectLibrary);
  private readonly files = inject(ProjectFileService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly addRoomOpen = signal(false);
  protected readonly sheetExpanded = signal(false);
  protected readonly panelTab = signal<PanelTab>('catalog');
  protected readonly loaded = signal(false);
  private fitted = false;

  protected readonly tabs = computed(() => [
    { id: 'catalog', label: this.i18n.t('editor.catalog') },
    { id: 'properties', label: this.i18n.t('editor.properties') },
  ]);

  protected readonly collisionCount = computed(() => this.state.collisions()?.colliding.size ?? 0);
  protected readonly saveLabel = computed(() => {
    switch (this.autosave.status()) {
      case 'pending':
        return this.i18n.t('editor.saving');
      case 'error':
        return this.i18n.t('editor.saveError');
      case 'saved':
        return this.i18n.t('editor.saved');
      default:
        return '';
    }
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.loadProject(id));
    });
    // Fit the plan once both the project and the canvas size are known.
    effect(() => {
      const size = this.state.canvasSize();
      if (!this.fitted && this.loaded() && size.width > 0) {
        this.fitted = true;
        untracked(() => this.state.fitToContent());
      }
    });
    // Selecting something on small screens jumps to the properties tab.
    effect(() => {
      if (this.state.selection().kind !== 'none') {
        untracked(() => this.panelTab.set('properties'));
      }
    });
  }

  protected selectTab(tab: string): void {
    this.panelTab.set(tab === 'properties' ? 'properties' : 'catalog');
  }

  protected placeFromCatalog(item: CatalogItem): void {
    const { width, height } = this.state.canvasSize();
    const center = screenToWorld(this.state.viewport(), vec(width / 2, height / 2));
    this.useCases.placeFurniture(item.spec, item.source === 'builtin' ? item.id : null, width > 0 ? center : undefined);
    if (this.breakpoints.isMobile()) this.sheetExpanded.set(false);
  }

  protected createCustom(spec: FurnitureSpec): void {
    this.useCases.createCustomFurniture(spec);
    this.toasts.show(this.i18n.t('custom.created', { name: spec.name }), 'success');
  }

  protected addRoom(value: RoomFormValue): void {
    this.useCases.addRoom(value);
    this.state.fitToContent();
  }

  protected exportProject(): void {
    const project = this.store.project();
    if (project) this.files.exportToFile(project);
  }

  protected async importProject(file: File): Promise<void> {
    const result = await this.files.importFromFile(file);
    if (!result.ok) {
      this.toasts.show(this.i18n.t('projects.importFailed', { reason: result.errors.slice(0, 2).join('; ') }), 'error');
      return;
    }
    await this.autosave.flush();
    const project = await this.library.import(result.project);
    this.toasts.show(this.i18n.t('projects.imported'), 'success');
    await this.router.navigate(['/project', project.id]);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.state.show3d() || isTextInputTarget(event.target) || this.isDialogOpen()) {
      return;
    }
    const action = resolveShortcut(event);
    if (action) {
      event.preventDefault();
      this.perform(action);
    }
  }

  private perform(action: EditorAction): void {
    switch (action.type) {
      case 'undo':
        this.undoRedo('undo');
        break;
      case 'redo':
        this.undoRedo('redo');
        break;
      case 'delete':
        this.useCases.deleteSelection();
        break;
      case 'duplicate':
        this.useCases.duplicateSelection();
        break;
      case 'rotate':
        this.useCases.rotateSelection(action.degrees);
        break;
      case 'nudge':
        this.useCases.nudgeSelection(vec(action.dx, action.dy));
        break;
      case 'selectAll':
        this.useCases.selectAll();
        break;
      case 'clearSelection':
        this.state.clearSelection();
        this.state.tool.set('select');
        break;
    }
  }

  private undoRedo(direction: 'undo' | 'redo'): void {
    const history = this.store.history();
    const command = direction === 'undo' ? history.past.at(-1) : history.future[0];
    if (!command) return;
    if (direction === 'undo') this.store.undo();
    else this.store.redo();
    const key = direction === 'undo' ? 'toast.undone' : 'toast.redone';
    this.toasts.show(this.i18n.t(key, { action: this.i18n.tryT(command.label) }), 'info', 1500);
  }

  private isDialogOpen(): boolean {
    return document.querySelector('dialog[open]') !== null;
  }

  private async loadProject(id: string): Promise<void> {
    this.loaded.set(false);
    this.fitted = false;
    const project = await this.library.load(id);
    if (!project) {
      this.toasts.show(this.i18n.t('projects.notFound'), 'error');
      await this.router.navigate(['/']);
      return;
    }
    this.store.load(project);
    this.state.clearSelection();
    this.loaded.set(true);
  }
}
