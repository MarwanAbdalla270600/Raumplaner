import { computed, inject, Injectable, signal } from '@angular/core';
import { EntityId } from '../../../core/domain/id';
import { ProjectStore } from '../../project/application/project-store';
import { Floor, FurnitureItem, Room } from '../../project/domain/model';
import { detectCollisions } from '../domain/collision';
import { Aabb, unionAabb, vec } from '../../../core/domain/geometry';
import { furnitureBounds } from '../../project/domain/furniture-geometry';
import { roomOuterBounds } from '../../project/domain/room-geometry';
import { DEFAULT_VIEWPORT, fitToBounds, Viewport, zoomAt } from '../domain/viewport';

export type Selection =
  | { readonly kind: 'none' }
  | { readonly kind: 'furniture'; readonly ids: ReadonlySet<EntityId> }
  | { readonly kind: 'room'; readonly id: EntityId };

export const NO_SELECTION: Selection = { kind: 'none' };

export type EditorTool = 'select' | 'draw-room';

/** Transient, not-yet-committed changes during a drag gesture. */
export interface Preview {
  readonly furniture: ReadonlyMap<EntityId, FurnitureItem>;
  readonly rooms: ReadonlyMap<EntityId, Room>;
  readonly guideX: number | null;
  readonly guideY: number | null;
}

export function applyPreview(floor: Floor, preview: Preview | null): Floor {
  if (!preview) {
    return floor;
  }
  return {
    ...floor,
    rooms: floor.rooms.map((room) => preview.rooms.get(room.id) ?? room),
    furniture: floor.furniture.map((item) => preview.furniture.get(item.id) ?? item),
  };
}

/** UI state of the 2D editor (selection, tool, viewport, live preview). */
@Injectable()
export class EditorState {
  private readonly store = inject(ProjectStore);

  readonly selection = signal<Selection>(NO_SELECTION);
  readonly tool = signal<EditorTool>('select');
  readonly viewport = signal<Viewport>(DEFAULT_VIEWPORT);
  readonly preview = signal<Preview | null>(null);
  readonly show3d = signal(false);
  /** Size of the drawing surface in px, reported by the canvas. */
  readonly canvasSize = signal({ width: 0, height: 0 });

  readonly contentBounds = computed<Aabb | null>(() => {
    const floor = this.store.activeFloor();
    return floor ? unionAabb([...floor.rooms.map(roomOuterBounds), ...floor.furniture.map(furnitureBounds)]) : null;
  });

  /** Floor as it should be displayed, including drag previews. */
  readonly displayFloor = computed<Floor | null>(() => {
    const floor = this.store.activeFloor();
    return floor ? applyPreview(floor, this.preview()) : null;
  });

  readonly collisions = computed(() => {
    const floor = this.displayFloor();
    return floor ? detectCollisions(floor) : null;
  });

  readonly selectedFurnitureIds = computed<ReadonlySet<EntityId>>(() => {
    const selection = this.selection();
    return selection.kind === 'furniture' ? selection.ids : new Set();
  });

  readonly selectedFurniture = computed<FurnitureItem[]>(() => {
    const ids = this.selectedFurnitureIds();
    return (this.displayFloor()?.furniture ?? []).filter((item) => ids.has(item.id));
  });

  readonly selectedRoom = computed<Room | null>(() => {
    const selection = this.selection();
    if (selection.kind !== 'room') {
      return null;
    }
    return this.displayFloor()?.rooms.find((room) => room.id === selection.id) ?? null;
  });

  selectFurniture(ids: Iterable<EntityId>): void {
    const set = new Set(ids);
    this.selection.set(set.size > 0 ? { kind: 'furniture', ids: set } : NO_SELECTION);
  }

  selectRoom(id: EntityId): void {
    this.selection.set({ kind: 'room', id });
  }

  clearSelection(): void {
    this.selection.set(NO_SELECTION);
  }

  zoomBy(factor: number): void {
    const { width, height } = this.canvasSize();
    this.viewport.update((viewport) => zoomAt(viewport, factor, vec(width / 2, height / 2)));
  }

  fitToContent(): void {
    const bounds = this.contentBounds();
    const { width, height } = this.canvasSize();
    if (bounds && width > 0 && height > 0) {
      this.viewport.set(fitToBounds(bounds, width, height));
    }
  }
}
