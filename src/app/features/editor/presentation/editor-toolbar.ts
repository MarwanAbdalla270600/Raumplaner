import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LENGTH_UNITS, LengthUnit } from '../../../core/domain/units';
import { I18nService } from '../../../core/i18n/i18n.service';
import { BreakpointService } from '../../../core/layout/breakpoint.service';
import { AppPreferencesComponent } from '../../../core/presentation/app-preferences';
import { ButtonComponent, IconComponent, SelectComponent, TooltipDirective } from '../../../design-system/components';
import { ProjectStore } from '../../project/application/project-store';
import { EditorState } from '../application/editor-state';
import { EditorUseCases } from '../application/editor-use-cases';
import { ZOOM_STEP_FACTOR } from '../domain/viewport';

@Component({
  selector: 'app-editor-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppPreferencesComponent, ButtonComponent, IconComponent, RouterLink, SelectComponent, TooltipDirective],
  templateUrl: './editor-toolbar.html',
  styleUrl: './editor-toolbar.scss',
})
export class EditorToolbarComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly store = inject(ProjectStore);
  protected readonly state = inject(EditorState);
  protected readonly useCases = inject(EditorUseCases);
  protected readonly breakpoints = inject(BreakpointService);

  readonly addRoom = output<void>();
  readonly exportProject = output<void>();
  readonly importProject = output<File>();

  protected readonly expanded = signal(false);
  protected readonly zoomStep = ZOOM_STEP_FACTOR;
  protected readonly unitOptions = LENGTH_UNITS.map((unit) => ({ value: unit, label: unit }));
  protected readonly floorOptions = computed(() =>
    this.store.floors().map((floor) => ({ value: floor.id, label: floor.name })),
  );
  protected readonly zoomPercent = computed(() => Math.round(this.state.viewport().scale * 100));
  protected readonly showSecondary = computed(() => !this.breakpoints.isMobile() || this.expanded());

  protected setUnit(value: string): void {
    if ((LENGTH_UNITS as readonly string[]).includes(value)) {
      this.store.updateSettings({ unit: value as LengthUnit });
    }
  }

  protected toggleSnap(): void {
    this.store.updateSettings({ snapEnabled: !this.store.settings()?.snapEnabled });
  }

  protected toggleDimensions(): void {
    this.store.updateSettings({ showDimensions: !this.store.settings()?.showDimensions });
  }

  protected toggleDrawTool(): void {
    this.state.tool.update((tool) => (tool === 'draw-room' ? 'select' : 'draw-room'));
    this.state.draft.set(null);
  }

  protected selectFloor(id: string): void {
    this.store.selectFloor(id);
    this.state.clearSelection();
  }

  protected onFile(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (file) this.importProject.emit(file);
  }
}
