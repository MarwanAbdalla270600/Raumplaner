import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  InjectionToken,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslationKey } from '../../../core/i18n/translations/de';
import { ButtonComponent, IconComponent, TooltipDirective } from '../../../design-system/components';
import { ProjectStore } from '../../project/application/project-store';
import { ProjectFileService } from '../../project/infrastructure/project-file.service';
import { EditorState } from '../../editor/application/editor-state';
import { CAMERA_PRESETS, CameraPresetId } from '../domain/camera-presets';
import { describeScene } from '../domain/scene-description';
import { SceneRenderer } from '../domain/scene-renderer';
import { isWebGlAvailable, ThreeSceneRenderer } from '../infrastructure/three-scene-renderer';

export const SCENE_RENDERER_FACTORY = new InjectionToken<() => SceneRenderer>('SCENE_RENDERER_FACTORY', {
  providedIn: 'root',
  factory: () => () => new ThreeSceneRenderer(),
});

const PRESET_LABELS: Record<CameraPresetId, TranslationKey> = {
  top: 'viewer.presetTop',
  perspective: 'viewer.presetPerspective',
  room: 'viewer.presetRoom',
};

/** Full-screen 3D view. Loaded lazily (@defer) together with Three.js. */
@Component({
  selector: 'app-viewer-3d',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconComponent, TooltipDirective],
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    <div
      class="overlay"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="i18n.t('viewer.title')"
      data-testid="viewer-3d"
    >
      <header>
        <h2>{{ i18n.t('viewer.title') }}</h2>
        <div class="presets" role="group" [attr.aria-label]="i18n.t('viewer.title')">
          @for (preset of presets; track preset) {
            <button
              dsButton
              size="sm"
              variant="ghost"
              [pressed]="preset === activePreset()"
              (click)="applyPreset(preset)"
            >
              {{ i18n.t(presetLabels[preset]) }}
            </button>
          }
        </div>
        <button
          dsButton
          size="sm"
          [iconOnly]="true"
          variant="ghost"
          [attr.aria-label]="i18n.t('viewer.screenshot')"
          [dsTooltip]="i18n.t('viewer.screenshot')"
          (click)="screenshot()"
          [disabled]="!supported"
        >
          <ds-icon name="camera" />
        </button>
        <button
          #closeButton
          dsButton
          size="sm"
          [iconOnly]="true"
          variant="ghost"
          [attr.aria-label]="i18n.t('viewer.close')"
          (click)="close()"
        >
          <ds-icon name="close" />
        </button>
      </header>
      <div #host class="stage">
        @if (!supported) {
          <p class="unsupported">{{ i18n.t('viewer.unsupported') }}</p>
        }
      </div>
      <p class="hint">{{ i18n.t('viewer.hint') }}</p>
    </div>
  `,
  styles: `
    .overlay {
      position: fixed;
      inset: 0;
      z-index: var(--ds-z-overlay);
      display: flex;
      flex-direction: column;
      background: var(--ds-color-surface);
    }
    header {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--ds-space-2);
      padding: var(--ds-space-2) var(--ds-space-3);
      border-bottom: 1px solid var(--ds-color-border);
    }
    h2 {
      font-size: var(--ds-font-size-md);
      margin-right: auto;
    }
    .presets {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ds-space-1);
    }
    .stage {
      position: relative;
      flex: 1;
      min-height: 0;
      touch-action: none;
    }
    .stage :is(canvas) {
      display: block;
    }
    .hint {
      margin: 0;
      padding: var(--ds-space-2) var(--ds-space-3);
      font-size: var(--ds-font-size-xs);
      color: var(--ds-color-text-muted);
    }
    .unsupported {
      padding: var(--ds-space-5);
      text-align: center;
    }
  `,
})
export class Viewer3dComponent {
  protected readonly i18n = inject(I18nService);
  private readonly store = inject(ProjectStore);
  private readonly editor = inject(EditorState);
  private readonly files = inject(ProjectFileService);
  private readonly createRenderer = inject(SCENE_RENDERER_FACTORY);
  private readonly hostElement = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly closeButton = viewChild.required('closeButton', { read: ElementRef<HTMLButtonElement> });

  readonly closed = output<void>();

  protected readonly presets = CAMERA_PRESETS;
  protected readonly presetLabels = PRESET_LABELS;
  protected readonly activePreset = signal<CameraPresetId>('perspective');
  protected readonly supported = isWebGlAvailable();
  private renderer: SceneRenderer | null = null;
  private readonly previousFocus = document.activeElement as HTMLElement | null;
  private readonly scene = computed(() => {
    const floor = this.store.activeFloor();
    return floor ? describeScene(floor) : null;
  });
  private readonly presetRoom = computed(
    () => this.editor.selectedRoom() ?? this.store.activeFloor()?.rooms[0] ?? null,
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      (this.closeButton().nativeElement as HTMLButtonElement).focus();
      if (!this.supported) return;
      const host = this.hostElement().nativeElement;
      const renderer = this.createRenderer();
      renderer.mount(host);
      this.renderer = renderer;
      const observer = new ResizeObserver(([entry]) =>
        renderer.resize(entry.contentRect.width, entry.contentRect.height),
      );
      observer.observe(host);
      renderer.resize(host.clientWidth, host.clientHeight);
      const scene = this.scene();
      if (scene) renderer.render(scene);
      renderer.applyPreset(this.activePreset(), this.presetRoom());
      destroyRef.onDestroy(() => observer.disconnect());
    });
    effect(() => {
      const scene = this.scene();
      untracked(() => {
        if (scene && this.renderer) this.renderer.render(scene);
      });
    });
    destroyRef.onDestroy(() => {
      this.renderer?.dispose();
      this.previousFocus?.focus?.();
    });
  }

  protected applyPreset(preset: CameraPresetId): void {
    this.activePreset.set(preset);
    this.renderer?.applyPreset(preset, this.presetRoom());
  }

  protected async screenshot(): Promise<void> {
    const blob = await this.renderer?.screenshot();
    if (blob) {
      this.files.download(blob, `${this.store.project()?.name ?? 'raumplaner'}-3d.png`);
    }
  }

  protected close(): void {
    this.closed.emit();
  }
}
