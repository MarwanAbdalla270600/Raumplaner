import { ChangeDetectionStrategy, Component, computed, inject, model, output, signal } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  ButtonComponent,
  DialogComponent,
  NumberFieldComponent,
  SelectComponent,
  TextFieldComponent,
} from '../../../design-system/components';
import { TranslationKey } from '../../../core/i18n/translations/de';
import { ROOM_SHAPES, RoomShape, shapePoints } from '../../project/domain/room-shapes';
import { ProjectStore } from '../../project/application/project-store';
import { DIMENSION_LIMITS, ROOM_DEFAULTS } from '../../project/domain/defaults';

export interface RoomFormValue {
  readonly name: string;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly shape: RoomShape;
}

const PREVIEW_SIZE = 120;
const PREVIEW_PADDING = 8;

@Component({
  selector: 'app-add-room-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, DialogComponent, NumberFieldComponent, SelectComponent, TextFieldComponent],
  template: `
    <ds-dialog [heading]="i18n.t('room.dialogTitle')" [(open)]="open">
      <form id="add-room-form" class="form" (submit)="$event.preventDefault(); submit()">
        <ds-text-field class="full" [label]="i18n.t('common.name')" [(value)]="name" data-testid="room-name" />
        <ds-select
          class="shape-select"
          [label]="i18n.t('room.shape')"
          [options]="shapeOptions()"
          [value]="shape()"
          (valueChange)="setShape($event)"
          data-testid="room-shape"
        />
        <svg class="preview" [attr.viewBox]="previewViewBox" aria-hidden="true">
          <polygon [attr.points]="previewPoints()" />
        </svg>
        <ds-number-field
          [label]="i18n.t('props.width')"
          [unit]="unit()"
          [min]="limits.minRoomLength"
          [max]="limits.maxLength"
          [value]="width()"
          (valueChange)="width.set($event)"
          data-testid="room-form-width"
        />
        <ds-number-field
          [label]="i18n.t('props.depth')"
          [unit]="unit()"
          [min]="limits.minRoomLength"
          [max]="limits.maxLength"
          [value]="depth()"
          (valueChange)="depth.set($event)"
        />
        <ds-number-field
          [label]="i18n.t('props.height')"
          [unit]="unit()"
          [min]="limits.minRoomLength"
          [max]="limits.maxLength"
          [value]="height()"
          (valueChange)="height.set($event)"
        />
      </form>
      <div dsDialogActions>
        <button dsButton (click)="open.set(false)">{{ i18n.t('common.cancel') }}</button>
        <button dsButton variant="primary" type="submit" form="add-room-form" data-testid="confirm-room">
          {{ i18n.t('common.create') }}
        </button>
      </div>
    </ds-dialog>
  `,
  styles: `
    .form {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--ds-space-3);
    }
    .full {
      grid-column: 1 / -1;
    }
    .shape-select {
      grid-column: 1 / 3;
    }
    .preview {
      grid-row: span 1;
      width: 100%;
      max-height: 120px;
    }
    .preview polygon {
      fill: color-mix(in srgb, var(--ds-color-primary) 15%, transparent);
      stroke: var(--ds-color-primary);
      stroke-width: 3;
      stroke-linejoin: round;
    }
  `,
})
export class AddRoomDialogComponent {
  protected readonly i18n = inject(I18nService);
  private readonly store = inject(ProjectStore);
  readonly open = model(false);
  readonly created = output<RoomFormValue>();

  protected readonly limits = DIMENSION_LIMITS;
  protected readonly unit = computed(() => this.store.settings()?.unit ?? 'cm');
  protected readonly name = signal('');
  protected readonly width = signal<number>(ROOM_DEFAULTS.width);
  protected readonly depth = signal<number>(ROOM_DEFAULTS.depth);
  protected readonly height = signal<number>(ROOM_DEFAULTS.height);
  protected readonly shape = signal<RoomShape>('rectangle');
  protected readonly shapeOptions = computed(() =>
    ROOM_SHAPES.map((shape) => ({ value: shape, label: this.i18n.t(`shape.${shape}` as TranslationKey) })),
  );
  protected readonly previewViewBox = `0 0 ${PREVIEW_SIZE} ${PREVIEW_SIZE}`;
  protected readonly previewPoints = computed(() => {
    const inner = PREVIEW_SIZE - 2 * PREVIEW_PADDING;
    const scale = inner / Math.max(this.width(), this.depth(), 1);
    const w = this.width() * scale;
    const d = this.depth() * scale;
    return shapePoints(this.shape(), w, d, (PREVIEW_SIZE - w) / 2, (PREVIEW_SIZE - d) / 2)
      .map((p) => `${p.x},${p.y}`)
      .join(' ');
  });

  protected setShape(value: string): void {
    if ((ROOM_SHAPES as readonly string[]).includes(value)) this.shape.set(value as RoomShape);
  }

  protected submit(): void {
    this.created.emit({
      name: this.name(),
      width: this.width(),
      depth: this.depth(),
      height: this.height(),
      shape: this.shape(),
    });
    this.name.set('');
    this.open.set(false);
  }
}
