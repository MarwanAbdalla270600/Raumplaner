import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { normalizeAngle, vec } from '../../../core/domain/geometry';
import { formatLength } from '../../../core/domain/units';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslationKey } from '../../../core/i18n/translations/de';
import {
  ButtonComponent,
  ColorFieldComponent,
  IconComponent,
  NumberFieldComponent,
  SelectComponent,
  SliderComponent,
  SwitchComponent,
  TextFieldComponent,
  TooltipDirective,
} from '../../../design-system/components';
import { ProjectStore } from '../../project/application/project-store';
import { DIMENSION_LIMITS, ROOM_DEFAULTS } from '../../project/domain/defaults';
import { FURNITURE_CATEGORIES, FurnitureItem, Opening } from '../../project/domain/model';
import { maxOpeningOffset, roomOrigin, roomSize, wallEdges } from '../../project/domain/room-geometry';
import { EditorState } from '../application/editor-state';
import { EditorUseCases, FurniturePatch, OpeningPatch } from '../application/editor-use-cases';
import { ROTATION_STEP_DEGREES } from '../domain/shortcuts';

const FULL_TURN = 360;

/** Exact numeric editing of the current selection. Every commit is one undo step. */
@Component({
  selector: 'app-properties-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    ColorFieldComponent,
    IconComponent,
    NumberFieldComponent,
    SelectComponent,
    SliderComponent,
    SwitchComponent,
    TextFieldComponent,
    TooltipDirective,
  ],
  templateUrl: './properties-panel.html',
  styleUrl: './properties-panel.scss',
})
export class PropertiesPanelComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly store = inject(ProjectStore);
  protected readonly state = inject(EditorState);
  protected readonly useCases = inject(EditorUseCases);

  protected readonly limits = DIMENSION_LIMITS;
  protected readonly defaultWallThickness = ROOM_DEFAULTS.wallThickness;
  protected readonly rotationStep = ROTATION_STEP_DEGREES;
  protected readonly fullTurn = FULL_TURN;
  protected readonly unit = computed(() => this.store.settings()?.unit ?? 'cm');
  protected readonly items = this.state.selectedFurniture;
  protected readonly item = computed<FurnitureItem | null>(() => (this.items().length === 1 ? this.items()[0] : null));
  protected readonly room = this.state.selectedRoom;
  protected readonly isColliding = computed(() => {
    const item = this.item();
    return item ? (this.state.collisions()?.colliding.has(item.id) ?? false) : false;
  });

  protected readonly categoryOptions = computed(() =>
    FURNITURE_CATEGORIES.map((category) => ({
      value: category,
      label: this.i18n.t(`category.${category}` as TranslationKey),
    })),
  );
  protected readonly roomGeometry = computed(() => {
    const room = this.room();
    if (!room) return null;
    const unit = this.unit();
    const locale = this.i18n.intlLocale();
    const walls = wallEdges(room).map((edge) => ({
      index: edge.index,
      label: this.i18n.t('props.wallLabel', { index: edge.index + 1, length: formatLength(edge.length, unit, locale) }),
    }));
    return { origin: roomOrigin(room), size: roomSize(room), walls };
  });
  protected readonly wallOptions = computed(() =>
    (this.roomGeometry()?.walls ?? []).map((wall) => ({ value: String(wall.index), label: wall.label })),
  );
  protected readonly gridOptions = [1, 5, 10, 25, 50].map((size) => ({ value: String(size), label: `${size} cm` }));

  protected updateItems(patch: FurniturePatch): void {
    this.useCases.updateFurniture(
      this.items().map((item) => item.id),
      patch,
    );
  }

  protected setRotation(degrees: number): void {
    this.updateItems({ rotation: normalizeAngle(degrees) });
  }

  protected updateRoom(patch: Parameters<EditorUseCases['updateRoom']>[1]): void {
    const room = this.room();
    if (room) this.useCases.updateRoom(room.id, patch);
  }

  protected setCorner(index: number, axis: 'x' | 'y', value: number): void {
    const room = this.room();
    const point = room?.points[index];
    if (room && point) {
      this.useCases.setVertex(room.id, index, axis === 'x' ? vec(value, point.y) : vec(point.x, value));
    }
  }

  protected removeCorner(index: number): void {
    const room = this.room();
    if (room) this.useCases.removeVertex(room.id, index);
  }

  protected attachRoom(wall: number): void {
    const room = this.room();
    if (room) this.useCases.attachRoom(room.id, wall);
  }

  protected setOpeningWall(opening: Opening, value: string): void {
    this.updateOpening(opening, { wall: Number(value) });
  }

  protected updateOpening(opening: Opening, patch: OpeningPatch): void {
    const room = this.room();
    if (room) this.useCases.updateOpening(room.id, opening.id, patch);
  }

  protected maxOffset(opening: Opening): number {
    const room = this.room();
    return room ? maxOpeningOffset(room, opening.wall, opening.width) : 0;
  }

  protected openingLabel(opening: Opening, index: number): string {
    return `${this.i18n.t(opening.kind === 'door' ? 'opening.door' : 'opening.window')} ${index + 1}`;
  }

  protected setGrid(value: string): void {
    const size = Number(value);
    if (Number.isFinite(size) && size > 0) this.store.updateSettings({ gridSize: size });
  }
}
