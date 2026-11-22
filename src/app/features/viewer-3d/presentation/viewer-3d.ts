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
import { ButtonComponent, IconComponent, SelectComponent, TooltipDirective } from '../../../design-system/components';
import { IconName } from '../../../design-system/components/icon';
import { ProjectStore } from '../../project/application/project-store';
import { ProjectFileService } from '../../project/infrastructure/project-file.service';
import { EditorState } from '../../editor/application/editor-state';
import { CAMERA_PRESETS, CameraPresetId } from '../domain/camera-presets';
import { describeScene } from '../domain/scene-description';
import { NO_TOUR_INPUT, roomAt, TourInput, tourObstacles, tourStart, tourStartInRoom } from '../domain/walkthrough';
import { SceneRenderer } from '../domain/scene-renderer';
import { isWebGlAvailable, ThreeSceneRenderer } from '../infrastructure/three-scene-renderer';

export const SCENE_RENDERER_FACTORY = new InjectionToken<() => SceneRenderer>('SCENE_RENDERER_FACTORY', {
  providedIn: 'root',
  factory: () => () => new ThreeSceneRenderer(),
});

type TourAxis = keyof TourInput;

interface TourButton {
  readonly axis: TourAxis;
  readonly value: number;
  readonly icon: IconName;
  readonly label: TranslationKey;
  readonly area: string;
}

/** On-screen arrows: hold to move. */
const TOUR_BUTTONS: readonly TourButton[] = [
  { axis: 'forward', value: 1, icon: 'arrowUp', label: 'viewer.tourForward', area: 'fwd' },
  { axis: 'turn', value: -1, icon: 'rotateLeft', label: 'viewer.tourTurnLeft', area: 'tl' },
  { axis: 'turn', value: 1, icon: 'rotateRight', label: 'viewer.tourTurnRight', area: 'tr' },
  { axis: 'strafe', value: -1, icon: 'arrowLeft', label: 'viewer.tourStrafeLeft', area: 'sl' },
  { axis: 'forward', value: -1, icon: 'arrowDown', label: 'viewer.tourBackward', area: 'back' },
  { axis: 'strafe', value: 1, icon: 'arrowRight', label: 'viewer.tourStrafeRight', area: 'sr' },
];

/** Keyboard mapping during the walkthrough. */
const TOUR_KEYS: Readonly<Record<string, readonly [TourAxis, number]>> = {
  ArrowUp: ['forward', 1],
  w: ['forward', 1],
  ArrowDown: ['forward', -1],
  s: ['forward', -1],
  ArrowLeft: ['turn', -1],
  q: ['turn', -1],
  ArrowRight: ['turn', 1],
  e: ['turn', 1],
  a: ['strafe', -1],
  d: ['strafe', 1],
};

const PRESET_LABELS: Record<CameraPresetId, TranslationKey> = {
  top: 'viewer.presetTop',
  perspective: 'viewer.presetPerspective',
  room: 'viewer.presetRoom',
};

/** Full-screen 3D view. Loaded lazily (@defer) together with Three.js. */
@Component({
  selector: 'app-viewer-3d',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconComponent, SelectComponent, TooltipDirective],
  host: {
    '(document:keydown)': 'onKeydown($event)',
    '(document:keyup)': 'onKeyup($event)',
    '(window:blur)': 'releaseAll()',
  },
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
              [pressed]="!touring() && preset === activePreset()"
              (click)="applyPreset(preset)"
            >
              {{ i18n.t(presetLabels[preset]) }}
            </button>
          }
          <button
            dsButton
            size="sm"
            variant="ghost"
            [pressed]="touring()"
            (click)="touring() ? applyPreset(activePreset()) : startTour()"
            [disabled]="!supported || !hasRooms()"
            data-testid="start-tour"
          >
            <ds-icon name="walk" [size]="18" /> {{ i18n.t('viewer.presetTour') }}
          </button>
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
        @if (touring()) {
          <div class="tour-room">
            <ds-select
              [label]="i18n.t('viewer.tourRoom')"
              [hideLabel]="true"
              [options]="roomOptions()"
              [value]="currentRoomId()"
              (valueChange)="enterRoom($event)"
              data-testid="tour-room"
            />
          </div>
          <div class="tour-pad" role="group" [attr.aria-label]="i18n.t('viewer.tourControls')" data-testid="tour-pad">
            @for (button of tourButtons; track button.area) {
              <button
                type="button"
                class="pad-button"
                [style.grid-area]="button.area"
                [class.active]="isHeld(button)"
                [attr.aria-label]="i18n.t(button.label)"
                [attr.data-testid]="'tour-' + button.area"
                (pointerdown)="hold(button, $event)"
                (pointerup)="release(button)"
                (pointerleave)="release(button)"
                (pointercancel)="release(button)"
                (keydown.enter)="nudge(button)"
                (keydown.space)="$event.preventDefault(); nudge(button)"
                (contextmenu)="$event.preventDefault()"
              >
                <ds-icon [name]="button.icon" [size]="26" />
              </button>
            }
          </div>
        }
      </div>
      <p class="hint">{{ touring() ? i18n.t('viewer.tourHint') : i18n.t('viewer.hint') }}</p>
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
    .tour-room {
      position: absolute;
      top: var(--ds-space-3);
      left: var(--ds-space-3);
      min-width: 12rem;
      max-width: calc(100% - 2 * var(--ds-space-3));
    }
    .tour-pad {
      position: absolute;
      right: var(--ds-space-4);
      bottom: var(--ds-space-4);
      display: grid;
      grid-template-areas:
        'tl fwd tr'
        'sl back sr';
      grid-template-columns: repeat(3, 56px);
      grid-template-rows: repeat(2, 56px);
      gap: var(--ds-space-2);
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }
    .pad-button {
      display: grid;
      place-items: center;
      border: 1px solid var(--ds-color-border);
      border-radius: var(--ds-radius-lg, 12px);
      background: color-mix(in srgb, var(--ds-color-surface) 85%, transparent);
      color: var(--ds-color-text);
      box-shadow: var(--ds-shadow-md, 0 2px 8px rgb(0 0 0 / 20%));
      backdrop-filter: blur(6px);
      cursor: pointer;
      touch-action: none;
    }
    .pad-button:hover {
      background: var(--ds-color-surface);
    }
    .pad-button.active {
      background: var(--ds-color-primary);
      color: var(--ds-color-on-primary, #fff);
      border-color: var(--ds-color-primary);
    }
    .pad-button:focus-visible {
      outline: 3px solid var(--ds-color-focus, var(--ds-color-primary));
      outline-offset: 2px;
    }
    @media (max-width: 480px) {
      .tour-pad {
        left: 50%;
        right: auto;
        transform: translateX(-50%);
      }
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
  protected readonly touring = signal(false);
  protected readonly tourButtons = TOUR_BUTTONS;
  protected readonly currentRoomId = signal('');
  private readonly held = signal<ReadonlyMap<string, readonly [TourAxis, number]>>(new Map());
  protected readonly hasRooms = computed(() => (this.store.activeFloor()?.rooms.length ?? 0) > 0);
  protected readonly roomOptions = computed(() =>
    (this.store.activeFloor()?.rooms ?? []).map((room) => ({ value: room.id, label: room.name })),
  );
  private roomTimer: ReturnType<typeof setInterval> | null = null;
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
    // Combine all held buttons/keys into one input vector.
    effect(() => {
      const input: Record<TourAxis, number> = { ...NO_TOUR_INPUT };
      this.held().forEach(([axis, value]) => (input[axis] = Math.max(-1, Math.min(1, input[axis] + value))));
      untracked(() => this.renderer?.setTourInput(input));
    });
    destroyRef.onDestroy(() => {
      this.stopRoomTracking();
      this.renderer?.dispose();
      this.previousFocus?.focus?.();
    });
  }

  protected applyPreset(preset: CameraPresetId): void {
    this.stopTour();
    this.activePreset.set(preset);
    this.renderer?.applyPreset(preset, this.presetRoom());
  }

  // ── Walkthrough ─────────────────────────────────────────────────────────

  protected startTour(): void {
    const floor = this.store.activeFloor();
    const scene = this.scene();
    const pose = floor ? tourStart(floor, this.editor.selectedRoom()) : null;
    if (!this.renderer || !scene || !pose) return;
    this.renderer.startTour(pose, tourObstacles(scene));
    this.touring.set(true);
    this.trackRoom();
  }

  protected enterRoom(roomId: string): void {
    const room = this.store.activeFloor()?.rooms.find((entry) => entry.id === roomId);
    const scene = this.scene();
    if (!room || !scene || !this.renderer) return;
    this.renderer.startTour(tourStartInRoom(room), tourObstacles(scene));
    this.currentRoomId.set(room.id);
  }

  protected isHeld(button: TourButton): boolean {
    return this.held().has(button.area);
  }

  protected hold(button: TourButton, event: PointerEvent): void {
    event.preventDefault();
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    this.setHeld(button.area, [button.axis, button.value]);
  }

  protected release(button: TourButton): void {
    this.setHeld(button.area, null);
  }

  /** Keyboard activation of a pad button: a short step. */
  protected nudge(button: TourButton): void {
    this.setHeld(button.area, [button.axis, button.value]);
    setTimeout(() => this.setHeld(button.area, null), 250);
  }

  protected releaseAll(): void {
    this.held.set(new Map());
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.touring()) this.applyPreset(this.activePreset());
      else this.close();
      return;
    }
    const mapping = this.touring() ? this.tourKey(event) : undefined;
    if (mapping) {
      event.preventDefault();
      this.setHeld(`key:${event.key.toLowerCase()}`, mapping);
    }
  }

  protected onKeyup(event: KeyboardEvent): void {
    this.setHeld(`key:${event.key.toLowerCase()}`, null);
  }

  private tourKey(event: KeyboardEvent): readonly [TourAxis, number] | undefined {
    if (event.ctrlKey || event.metaKey || event.altKey) return undefined;
    const target = event.target as HTMLElement | null;
    if (target?.tagName === 'SELECT' || target?.tagName === 'INPUT') return undefined;
    return TOUR_KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key];
  }

  private setHeld(id: string, value: readonly [TourAxis, number] | null): void {
    this.held.update((current) => {
      if (value === null && !current.has(id)) return current;
      const next = new Map(current);
      if (value) next.set(id, value);
      else next.delete(id);
      return next;
    });
  }

  private stopTour(): void {
    if (!this.touring()) return;
    this.renderer?.stopTour();
    this.touring.set(false);
    this.releaseAll();
    this.stopRoomTracking();
  }

  /** Keeps the room picker in sync with the walker's position. */
  private trackRoom(): void {
    this.stopRoomTracking();
    const update = (): void => {
      const pose = this.renderer?.tourPose();
      const floor = this.store.activeFloor();
      const room = pose && floor ? roomAt(floor, pose.position) : null;
      if (room) this.currentRoomId.set(room.id);
    };
    update();
    this.roomTimer = setInterval(update, 400);
  }

  private stopRoomTracking(): void {
    if (this.roomTimer !== null) clearInterval(this.roomTimer);
    this.roomTimer = null;
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
