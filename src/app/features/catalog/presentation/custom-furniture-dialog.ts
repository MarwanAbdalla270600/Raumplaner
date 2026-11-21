import { ChangeDetectionStrategy, Component, computed, inject, model, output, signal } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslationKey } from '../../../core/i18n/translations/de';
import {
  ButtonComponent,
  ColorFieldComponent,
  DialogComponent,
  NumberFieldComponent,
  SelectComponent,
  TextFieldComponent,
} from '../../../design-system/components';
import { ProjectStore } from '../../project/application/project-store';
import { DIMENSION_LIMITS } from '../../project/domain/defaults';
import { FURNITURE_CATEGORIES, FurnitureCategory, FurnitureSpec } from '../../project/domain/model';

const INITIAL_SPEC: FurnitureSpec = {
  name: '',
  category: 'other',
  width: 100,
  depth: 50,
  height: 80,
  color: '#8a9bb0',
  material: null,
  weight: null,
};

@Component({
  selector: 'app-custom-furniture-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    ColorFieldComponent,
    DialogComponent,
    NumberFieldComponent,
    SelectComponent,
    TextFieldComponent,
  ],
  template: `
    <ds-dialog [heading]="i18n.t('custom.dialogTitle')" [(open)]="open">
      <form id="custom-furniture-form" class="form" (submit)="$event.preventDefault(); submit()">
        <ds-text-field
          class="full"
          [label]="i18n.t('common.name')"
          [value]="spec().name"
          (valueChange)="patch({ name: $event })"
          [required]="true"
        />
        <ds-select
          [label]="i18n.t('props.category')"
          [options]="categoryOptions()"
          [value]="spec().category"
          (valueChange)="patch({ category: $any($event) })"
        />
        <ds-color-field
          [label]="i18n.t('props.color')"
          [value]="spec().color"
          (valueChange)="patch({ color: $event })"
        />
        <ds-number-field
          [label]="i18n.t('props.width')"
          [unit]="unit()"
          [min]="limits.minLength"
          [max]="limits.maxLength"
          [value]="spec().width"
          (valueChange)="patch({ width: $event })"
        />
        <ds-number-field
          [label]="i18n.t('props.depth')"
          [unit]="unit()"
          [min]="limits.minLength"
          [max]="limits.maxLength"
          [value]="spec().depth"
          (valueChange)="patch({ depth: $event })"
        />
        <ds-number-field
          [label]="i18n.t('props.height')"
          [unit]="unit()"
          [min]="limits.minLength"
          [max]="limits.maxLength"
          [value]="spec().height"
          (valueChange)="patch({ height: $event })"
        />
        <ds-number-field
          [label]="i18n.t('props.weight')"
          unit="kg"
          [min]="0"
          [value]="spec().weight"
          (valueChange)="patch({ weight: $event })"
        />
        <ds-text-field
          class="full"
          [label]="i18n.t('props.material')"
          [value]="spec().material ?? ''"
          (valueChange)="patch({ material: $event || null })"
        />
      </form>
      @if (invalid()) {
        <p class="error" role="alert">{{ i18n.t('custom.invalid') }}</p>
      }
      <div dsDialogActions>
        <button dsButton (click)="open.set(false)">{{ i18n.t('common.cancel') }}</button>
        <button dsButton variant="primary" type="submit" form="custom-furniture-form">
          {{ i18n.t('common.create') }}
        </button>
      </div>
    </ds-dialog>
  `,
  styles: `
    .form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--ds-space-3);
    }
    .full {
      grid-column: 1 / -1;
    }
    .error {
      margin: 0;
      color: var(--ds-color-danger);
    }
  `,
})
export class CustomFurnitureDialogComponent {
  protected readonly i18n = inject(I18nService);
  private readonly store = inject(ProjectStore);
  readonly open = model(false);
  readonly created = output<FurnitureSpec>();

  protected readonly limits = DIMENSION_LIMITS;
  protected readonly spec = signal<FurnitureSpec>(INITIAL_SPEC);
  protected readonly invalid = signal(false);
  protected readonly unit = computed(() => this.store.settings()?.unit ?? 'cm');
  protected readonly categoryOptions = computed(() =>
    FURNITURE_CATEGORIES.map((category: FurnitureCategory) => ({
      value: category,
      label: this.i18n.t(`category.${category}` as TranslationKey),
    })),
  );

  protected patch(patch: Partial<FurnitureSpec>): void {
    this.spec.update((spec) => ({ ...spec, ...patch }));
  }

  protected submit(): void {
    const spec = { ...this.spec(), name: this.spec().name.trim() };
    const valid =
      spec.name.length > 0 && [spec.width, spec.depth, spec.height].every((v) => v >= DIMENSION_LIMITS.minLength);
    this.invalid.set(!valid);
    if (!valid) {
      return;
    }
    this.created.emit(spec);
    this.spec.set(INITIAL_SPEC);
    this.open.set(false);
  }
}
