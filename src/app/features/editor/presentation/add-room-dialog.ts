import { ChangeDetectionStrategy, Component, computed, inject, model, output, signal } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  ButtonComponent,
  DialogComponent,
  NumberFieldComponent,
  TextFieldComponent,
} from '../../../design-system/components';
import { ProjectStore } from '../../project/application/project-store';
import { DIMENSION_LIMITS, ROOM_DEFAULTS } from '../../project/domain/defaults';

export interface RoomFormValue {
  readonly name: string;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
}

@Component({
  selector: 'app-add-room-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, DialogComponent, NumberFieldComponent, TextFieldComponent],
  template: `
    <ds-dialog [heading]="i18n.t('room.dialogTitle')" [(open)]="open">
      <form id="add-room-form" class="form" (submit)="$event.preventDefault(); submit()">
        <ds-text-field class="full" [label]="i18n.t('common.name')" [(value)]="name" data-testid="room-name" />
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

  protected submit(): void {
    this.created.emit({ name: this.name(), width: this.width(), depth: this.depth(), height: this.height() });
    this.name.set('');
    this.open.set(false);
  }
}
