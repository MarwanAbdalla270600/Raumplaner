import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
  afterNextRender,
} from '@angular/core';
import { Aabb, aabbFromCorners, aabbWidth, aabbHeight, Vec2, vec } from '../../../../core/domain/geometry';
import { EntityId } from '../../../../core/domain/id';
import { formatLength } from '../../../../core/domain/units';
import { contrastingTextColor } from '../../../../core/domain/color';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { CatalogStore } from '../../../catalog/application/catalog-store';
import { ProjectStore } from '../../../project/application/project-store';
import { furnitureBounds, sortByLayer } from '../../../project/domain/furniture-geometry';
import { FurnitureItem } from '../../../project/domain/model';
import { openingRect, roomArea, roomCenter, roomInnerBounds, wallRects } from '../../../project/domain/room-geometry';
import {
  drawnRoomBounds,
  FurnitureDragSession,
  isValidRoomSize,
  RoomDragSession,
  SnapOptions,
} from '../../application/drag-sessions';
import { EditorState } from '../../application/editor-state';
import { EditorUseCases } from '../../application/editor-use-cases';
import { computeClearances } from '../../domain/measurements';
import { doorSymbolPath, windowSymbolPath } from '../../domain/opening-symbols';
import { furnitureInMarquee, toggleSelection } from '../../domain/selection';
import { SNAP_THRESHOLD_PX, snapToGrid } from '../../domain/snapping';
import { FREE_ROTATION_SNAP_DEGREES, resizeFromCorner, rotationTowards } from '../../domain/transform';
import { panBy, screenToWorld, Viewport, zoomAt } from '../../domain/viewport';

import { CATALOG_DRAG_MIME } from '../../../catalog/presentation/catalog-panel';

/** Pixels the pointer must travel before a press becomes a drag. */
const DRAG_THRESHOLD_PX = 4;
const LONG_PRESS_MS = 500;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const LABEL_FONT_PX = 12;
const ROOM_LABEL_FONT_PX = 13;
const HANDLE_SIZE_PX = 12;
/** Larger handles for touch input (WCAG 2.5.5 target size). */
const HANDLE_SIZE_TOUCH_PX = 28;
const ROTATE_HANDLE_DISTANCE_PX = 28;
const MIN_LABEL_SIZE_PX = 36;
const MIN_GRID_CELL_PX = 6;
const MAJOR_GRID_FACTOR = 10;
const CM2_PER_M2 = 10_000;

type Gesture =
  | { readonly kind: 'pan'; last: Vec2; readonly clickRoomId: EntityId | null; moved: boolean }
  | {
      readonly kind: 'marquee';
      readonly startWorld: Vec2;
      readonly additive: boolean;
      readonly clickRoomId: EntityId | null;
      moved: boolean;
    }
  | {
      readonly kind: 'furniture';
      readonly session: FurnitureDragSession;
      readonly startWorld: Vec2;
      readonly clickedId: EntityId;
      moved: boolean;
    }
  | { readonly kind: 'room'; readonly session: RoomDragSession; readonly startWorld: Vec2; moved: boolean }
  | { readonly kind: 'resize'; readonly item: FurnitureItem; readonly startWorld: Vec2; moved: boolean }
  | { readonly kind: 'rotate'; readonly item: FurnitureItem; moved: boolean }
  | { readonly kind: 'draw'; readonly startWorld: Vec2; moved: boolean }
  | {
      readonly kind: 'pinch';
      readonly startDistance: number;
      readonly startViewport: Viewport;
      readonly startCenter: Vec2;
    };

interface HitTarget {
  readonly itemId: EntityId | null;
  readonly roomId: EntityId | null;
  readonly part: 'floor' | 'wall' | null;
  readonly handle: 'resize' | 'rotate' | null;
}

function hitTest(target: EventTarget | null): HitTarget {
  const element = target instanceof Element ? target : null;
  const item = element?.closest<SVGElement>('[data-item-id]');
  const room = element?.closest<SVGElement>('[data-room-id]');
  const handle = element?.closest<SVGElement>('[data-handle]')?.dataset['handle'];
  return {
    itemId: item?.dataset['itemId'] ?? null,
    roomId: room?.dataset['roomId'] ?? null,
    part: (room?.dataset['part'] as HitTarget['part']) ?? null,
    handle: handle === 'resize' || handle === 'rotate' ? handle : null,
  };
}

const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Vec2, b: Vec2): Vec2 => vec((a.x + b.x) / 2, (a.y + b.y) / 2);

@Component({
  selector: 'app-floor-plan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './floor-plan.html',
  styleUrl: './floor-plan.scss',
})
export class FloorPlanComponent {
  private readonly store = inject(ProjectStore);
  protected readonly state = inject(EditorState);
  private readonly useCases = inject(EditorUseCases);
  private readonly catalog = inject(CatalogStore);
  protected readonly i18n = inject(I18nService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');

  // ── Derived view model ───────────────────────────────────────────────────

  protected readonly floor = this.state.displayFloor;
  protected readonly settings = this.store.settings;
  protected readonly marquee = signal<Aabb | null>(null);
  protected readonly drawRect = signal<Aabb | null>(null);

  protected readonly worldTransform = computed(() => {
    const { offsetX, offsetY, scale } = this.state.viewport();
    return `translate(${offsetX} ${offsetY}) scale(${scale})`;
  });

  /** One screen pixel in world units – used to keep strokes and labels at a fixed pixel size. */
  protected readonly px = computed(() => 1 / this.state.viewport().scale);

  protected readonly grid = computed(() => {
    const { offsetX, offsetY, scale } = this.state.viewport();
    const gridSize = this.settings()?.gridSize ?? 10;
    const minor = gridSize * scale;
    return {
      minor,
      showMinor: minor >= MIN_GRID_CELL_PX,
      major: minor * MAJOR_GRID_FACTOR,
      transform: `translate(${offsetX} ${offsetY})`,
    };
  });

  protected readonly selectedRoomId = computed(() => this.state.selectedRoom()?.id ?? null);

  protected readonly rooms = computed(() => {
    const unit = this.settings()?.unit ?? 'cm';
    const locale = this.i18n.intlLocale();
    return (this.floor()?.rooms ?? []).map((room) => {
      const inner = roomInnerBounds(room);
      const center = roomCenter(room);
      return {
        room,
        walls: wallRects(room),
        openings: room.openings.map((opening) => ({
          opening,
          rect: openingRect(room, opening),
          symbol: opening.kind === 'door' ? doorSymbolPath(room, opening) : windowSymbolPath(room, opening),
        })),
        center,
        labelColor: contrastingTextColor(room.floorColor),
        area: `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(roomArea(room) / CM2_PER_M2)} m²`,
        widthLabel: formatLength(room.width, unit, locale),
        depthLabel: formatLength(room.depth, unit, locale),
        inner,
      };
    });
  });

  protected readonly furniture = computed(() => {
    const floor = this.floor();
    const collisions = this.state.collisions()?.colliding ?? new Set<EntityId>();
    const selected = this.state.selectedFurnitureIds();
    const scale = this.state.viewport().scale;
    return sortByLayer(floor?.furniture ?? []).map((item) => ({
      item,
      transform: `translate(${item.x} ${item.y}) rotate(${item.rotation})`,
      selected: selected.has(item.id),
      colliding: collisions.has(item.id),
      showLabel: Math.min(item.width, item.depth) * scale >= MIN_LABEL_SIZE_PX,
      labelColor: contrastingTextColor(item.color),
    }));
  });

  protected readonly singleSelection = computed(() => {
    const items = this.state.selectedFurniture();
    return items.length === 1 ? items[0] : null;
  });

  protected readonly handles = computed(() => {
    const item = this.singleSelection();
    const px = this.px();
    if (!item) return null;
    return {
      transform: `translate(${item.x} ${item.y}) rotate(${item.rotation})`,
      size: this.handleSizePx * px,
      resizeX: item.width / 2,
      resizeY: item.depth / 2,
      rotateY: -item.depth / 2 - ROTATE_HANDLE_DISTANCE_PX * px,
      topY: -item.depth / 2,
    };
  });

  protected readonly clearances = computed(() => {
    const item = this.singleSelection();
    const floor = this.floor();
    if (!item || !floor || !this.settings()?.showDimensions) {
      return [];
    }
    const unit = this.settings()?.unit ?? 'cm';
    const obstacles = [
      ...floor.rooms.flatMap(wallRects),
      ...floor.furniture.filter((other) => other.id !== item.id).map(furnitureBounds),
    ];
    return computeClearances(furnitureBounds(item), obstacles)
      .filter((clearance) => clearance.distance > 0)
      .map((clearance) => ({
        ...clearance,
        label: formatLength(clearance.distance, unit, this.i18n.intlLocale()),
        labelX: (clearance.from.x + clearance.to.x) / 2,
        labelY: (clearance.from.y + clearance.to.y) / 2,
      }));
  });

  protected readonly selectionAnnouncement = computed(() => {
    const items = this.state.selectedFurniture();
    const room = this.state.selectedRoom();
    if (items.length === 1) return items[0].name;
    if (items.length > 1) return this.i18n.t('editor.selectionCount', { count: items.length });
    return room?.name ?? '';
  });

  protected readonly labelFont = computed(() => LABEL_FONT_PX * this.px());
  protected readonly roomLabelFont = computed(() => ROOM_LABEL_FONT_PX * this.px());

  // ── Gesture state (not rendered, therefore plain fields) ────────────────

  private readonly handleSizePx = globalThis.matchMedia?.('(pointer: coarse)').matches
    ? HANDLE_SIZE_TOUCH_PX
    : HANDLE_SIZE_PX;
  private gesture: Gesture | null = null;
  private readonly pointers = new Map<number, Vec2>();
  private pressScreen: Vec2 = vec(0, 0);
  private svgRect: DOMRect | null = null;
  private frame: number | null = null;
  private lastEvent: PointerEvent | null = null;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const observer = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        this.state.canvasSize.set({ width, height });
      });
      observer.observe(this.host.nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
    destroyRef.onDestroy(() => {
      if (this.frame !== null) cancelAnimationFrame(this.frame);
      this.clearLongPress();
    });
  }

  // ── Pointer handling ─────────────────────────────────────────────────────

  protected onPointerDown(event: PointerEvent): void {
    this.svgRect = this.svg().nativeElement.getBoundingClientRect();
    const screen = this.toScreen(event);
    this.pointers.set(event.pointerId, screen);
    this.svg().nativeElement.setPointerCapture?.(event.pointerId);
    this.svg().nativeElement.focus({ preventScroll: true });

    if (this.pointers.size === 2) {
      this.startPinch();
      return;
    }
    if (this.pointers.size > 2) {
      return;
    }
    this.pressScreen = screen;
    this.gesture = this.startGesture(event, screen);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId)) {
      return;
    }
    this.pointers.set(event.pointerId, this.toScreen(event));
    this.lastEvent = event;
    this.frame ??= requestAnimationFrame(() => {
      this.frame = null;
      if (this.lastEvent) this.processMove(this.lastEvent);
    });
  }

  protected onPointerUp(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);
    this.clearLongPress();
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
      if (this.lastEvent) this.processMove(this.lastEvent);
    }
    const gesture = this.gesture;
    if (gesture?.kind === 'pinch') {
      if (this.pointers.size === 0) this.gesture = null;
      return;
    }
    this.gesture = null;
    if (gesture) this.finishGesture(gesture, event);
  }

  protected onPointerCancel(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);
    this.clearLongPress();
    this.gesture = null;
    this.state.preview.set(null);
    this.marquee.set(null);
    this.drawRect.set(null);
  }

  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.svgRect = this.svg().nativeElement.getBoundingClientRect();
    const anchor = this.toScreen(event);
    const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY);
    this.state.viewport.update((viewport) => zoomAt(viewport, factor, anchor));
  }

  protected onDragOver(event: DragEvent): void {
    if (event.dataTransfer?.types.includes(CATALOG_DRAG_MIME)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  protected onDrop(event: DragEvent): void {
    const id = event.dataTransfer?.getData(CATALOG_DRAG_MIME);
    const item = id ? this.catalog.find(id) : undefined;
    if (!item) {
      return;
    }
    event.preventDefault();
    this.svgRect = this.svg().nativeElement.getBoundingClientRect();
    const world = this.toWorld(this.toScreen(event));
    const grid = this.settings()?.snapEnabled ? (this.settings()?.gridSize ?? 0) : 0;
    const position = vec(snapToGrid(world.x, grid), snapToGrid(world.y, grid));
    this.useCases.placeFurniture(item.spec, item.source === 'builtin' ? item.id : null, position);
  }

  // ── Gesture lifecycle ────────────────────────────────────────────────────

  private startGesture(event: PointerEvent, screen: Vec2): Gesture | null {
    const world = this.toWorld(screen);
    const floor = this.store.activeFloor();
    const hit = hitTest(event.target);
    const isTouch = event.pointerType === 'touch';
    const isPanButton = event.button === 1 || event.button === 2;

    if (!floor) return null;
    if (isPanButton) return { kind: 'pan', last: screen, clickRoomId: null, moved: false };
    if (this.state.tool() === 'draw-room') return { kind: 'draw', startWorld: world, moved: false };

    const item = this.singleSelection();
    if (hit.handle && item) {
      return hit.handle === 'resize'
        ? { kind: 'resize', item, startWorld: world, moved: false }
        : { kind: 'rotate', item, moved: false };
    }

    if (hit.itemId) {
      return this.startFurnitureDrag(hit.itemId, event, world, isTouch);
    }

    const roomSelected = hit.roomId !== null && hit.roomId === this.selectedRoomId();
    if (hit.roomId && (hit.part === 'wall' || roomSelected)) {
      this.state.selectRoom(hit.roomId);
      return {
        kind: 'room',
        session: new RoomDragSession(floor, hit.roomId, this.snapOptions(event)),
        startWorld: world,
        moved: false,
      };
    }

    return isTouch
      ? { kind: 'pan', last: screen, clickRoomId: hit.roomId, moved: false }
      : { kind: 'marquee', startWorld: world, additive: event.shiftKey, clickRoomId: hit.roomId, moved: false };
  }

  private startFurnitureDrag(id: EntityId, event: PointerEvent, world: Vec2, isTouch: boolean): Gesture | null {
    const floor = this.store.activeFloor();
    if (!floor) return null;
    const current = this.state.selectedFurnitureIds();
    if (event.shiftKey) {
      this.state.selectFurniture(toggleSelection(current, id, true));
      return null;
    }
    if (!current.has(id)) {
      this.state.selectFurniture([id]);
    }
    if (isTouch) {
      this.scheduleLongPress(id);
    }
    const ids = this.state.selectedFurnitureIds();
    return {
      kind: 'furniture',
      session: new FurnitureDragSession(floor, ids, this.snapOptions(event)),
      startWorld: world,
      clickedId: id,
      moved: false,
    };
  }

  private processMove(event: PointerEvent): void {
    const gesture = this.gesture;
    if (!gesture) return;
    if (gesture.kind === 'pinch') {
      this.updatePinch(gesture);
      return;
    }
    const screen = this.pointers.get(event.pointerId) ?? this.toScreen(event);
    if (!gesture.moved && distance(screen, this.pressScreen) < DRAG_THRESHOLD_PX) {
      return;
    }
    gesture.moved = true;
    this.clearLongPress();
    const world = this.toWorld(screen);

    switch (gesture.kind) {
      case 'pan':
        this.state.viewport.update((viewport) =>
          panBy(viewport, vec(screen.x - gesture.last.x, screen.y - gesture.last.y)),
        );
        gesture.last = screen;
        break;
      case 'marquee':
        this.marquee.set(aabbFromCorners(gesture.startWorld, world));
        break;
      case 'furniture':
        this.state.preview.set(
          gesture.session.preview(vec(world.x - gesture.startWorld.x, world.y - gesture.startWorld.y)),
        );
        break;
      case 'room':
        this.state.preview.set(
          gesture.session.preview(vec(world.x - gesture.startWorld.x, world.y - gesture.startWorld.y)),
        );
        break;
      case 'resize': {
        const grid = this.snapOptions(event).enabled ? (this.settings()?.gridSize ?? null) : null;
        const resized = resizeFromCorner(
          gesture.item,
          vec(world.x - gesture.startWorld.x, world.y - gesture.startWorld.y),
          grid,
        );
        this.previewItem(resized);
        break;
      }
      case 'rotate': {
        const step = this.snapOptions(event).enabled ? FREE_ROTATION_SNAP_DEGREES : null;
        this.previewItem({ ...gesture.item, rotation: rotationTowards(gesture.item, world, step) });
        break;
      }
      case 'draw':
        this.drawRect.set(drawnRoomBounds(gesture.startWorld, world, this.snapOptions(event)));
        break;
    }
  }

  private finishGesture(gesture: Exclude<Gesture, { kind: 'pinch' }>, event: PointerEvent): void {
    const preview = this.state.preview();
    this.state.preview.set(null);

    switch (gesture.kind) {
      case 'pan':
      case 'marquee':
        this.finishSelectionGesture(gesture, event);
        break;
      case 'furniture':
        if (gesture.moved && preview) {
          const before = gesture.session.original;
          const after = before.map((item) => preview.furniture.get(item.id) ?? item);
          this.useCases.commitFurnitureChange(before, after, 'command.moveFurniture');
        } else if (!gesture.moved && this.state.selectedFurnitureIds().size > 1) {
          this.state.selectFurniture([gesture.clickedId]);
        }
        break;
      case 'room':
        if (gesture.moved && preview) {
          const after = preview.rooms.get(gesture.session.room.id);
          const contained = gesture.session.contained;
          if (after) {
            this.useCases.commitRoomMove(
              gesture.session.room,
              after,
              contained,
              contained.map((item) => preview.furniture.get(item.id) ?? item),
            );
          }
        }
        break;
      case 'resize':
      case 'rotate': {
        const after = preview?.furniture.get(gesture.item.id);
        if (gesture.moved && after) {
          this.useCases.commitFurnitureChange(
            [gesture.item],
            [after],
            gesture.kind === 'rotate' ? 'command.rotateFurniture' : 'command.updateFurniture',
          );
        }
        break;
      }
      case 'draw': {
        const bounds = this.drawRect();
        this.drawRect.set(null);
        if (bounds && isValidRoomSize(bounds)) {
          this.useCases.addRoomFromBounds(bounds);
          this.state.tool.set('select');
        }
        break;
      }
    }
  }

  private finishSelectionGesture(gesture: Extract<Gesture, { kind: 'pan' | 'marquee' }>, event: PointerEvent): void {
    const marquee = this.marquee();
    this.marquee.set(null);
    if (gesture.kind === 'marquee' && gesture.moved && marquee) {
      const hits = furnitureInMarquee(this.store.activeFloor()?.furniture ?? [], marquee);
      const base = gesture.additive ? [...this.state.selectedFurnitureIds()] : [];
      this.state.selectFurniture([...base, ...hits]);
      return;
    }
    if (gesture.moved) {
      return;
    }
    if (gesture.clickRoomId) {
      this.state.selectRoom(gesture.clickRoomId);
    } else if (!event.shiftKey) {
      this.state.clearSelection();
    }
  }

  private startPinch(): void {
    this.clearLongPress();
    this.state.preview.set(null);
    this.marquee.set(null);
    const [a, b] = [...this.pointers.values()];
    this.gesture = {
      kind: 'pinch',
      startDistance: Math.max(1, distance(a, b)),
      startViewport: this.state.viewport(),
      startCenter: midpoint(a, b),
    };
  }

  private updatePinch(gesture: Extract<Gesture, { kind: 'pinch' }>): void {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return;
    const center = midpoint(a, b);
    const zoomed = zoomAt(gesture.startViewport, distance(a, b) / gesture.startDistance, gesture.startCenter);
    this.state.viewport.set(panBy(zoomed, vec(center.x - gesture.startCenter.x, center.y - gesture.startCenter.y)));
  }

  private scheduleLongPress(id: EntityId): void {
    this.clearLongPress();
    const before = this.state.selectedFurnitureIds();
    this.longPressTimer = setTimeout(() => {
      this.gesture = null;
      const base = new Set(before);
      this.state.selectFurniture(toggleSelection(base.size > 0 ? base : new Set(), id, true));
      navigator.vibrate?.(10);
    }, LONG_PRESS_MS);
  }

  private clearLongPress(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private previewItem(item: FurnitureItem): void {
    this.state.preview.set({ furniture: new Map([[item.id, item]]), rooms: new Map(), guideX: null, guideY: null });
  }

  private snapOptions(event: { altKey: boolean }): SnapOptions {
    const settings = this.settings();
    return {
      enabled: (settings?.snapEnabled ?? true) && !event.altKey,
      gridSize: settings?.gridSize ?? 10,
      threshold: SNAP_THRESHOLD_PX / this.state.viewport().scale,
    };
  }

  private toScreen(event: { clientX: number; clientY: number }): Vec2 {
    const rect = this.svgRect ?? this.svg().nativeElement.getBoundingClientRect();
    return vec(event.clientX - rect.left, event.clientY - rect.top);
  }

  private toWorld(screen: Vec2): Vec2 {
    return screenToWorld(this.state.viewport(), screen);
  }

  protected boxWidth = aabbWidth;
  protected boxHeight = aabbHeight;
}
