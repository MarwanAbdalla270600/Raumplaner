import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { roundTo } from '../../core/domain/geometry';
import { fromDisplayUnit, inputStep, LengthUnit, toDisplayUnit } from '../../core/domain/units';
import { I18nService } from '../../core/i18n/i18n.service';
import { uniqueId } from './unique-id';

export type NumberFieldUnit = LengthUnit | '°' | 'kg' | '';

/** Precision of committed values (avoids floating point noise like 251.00000000000003). */
const BASE_DECIMALS = 3;

const isLength = (unit: NumberFieldUnit): unit is LengthUnit => unit === 'cm' || unit === 'm';

/**
 * Numeric input with unit suffix. The value is always in base units (cm for lengths);
 * conversion to the display unit happens inside the component. Emits only on commit
 * (change / Enter) so that every edit is one undo step.
 */
@Component({
  selector: 'ds-number-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="ds-field__label" [for]="id">{{ label() }}</label>
    <div class="ds-field__control">
      <input
        [id]="id"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        role="spinbutton"
        [value]="displayText()"
        [attr.aria-valuenow]="displayValue()"
        [attr.aria-valuemin]="displayMin()"
        [attr.aria-valuemax]="displayMax()"
        [disabled]="disabled()"
        (change)="commit($any($event.target))"
        (keydown.enter)="commit($any($event.target))"
        (keydown.arrowup)="stepBy($event, 1)"
        (keydown.arrowdown)="stepBy($event, -1)"
      />
      @if (unit()) {
        <span class="ds-field__suffix" aria-hidden="true">{{ unit() }}</span>
      }
    </div>
  `,
  styleUrl: './field.scss',
})
export class NumberFieldComponent {
  readonly label = input.required<string>();
  /** Value in base units (cm, degrees, kg). */
  readonly value = input<number | null>(null);
  readonly unit = input<NumberFieldUnit>('');
  readonly min = input<number | null>(null);
  readonly max = input<number | null>(null);
  readonly step = input<number | null>(null);
  readonly disabled = input(false);
  readonly valueChange = output<number>();

  protected readonly id = uniqueId('ds-number');
  private readonly i18n = inject(I18nService);

  private toDisplay(value: number | null): number | null {
    const unit = this.unit();
    return value === null ? null : isLength(unit) ? toDisplayUnit(value, unit) : value;
  }

  protected readonly displayValue = computed(() => this.toDisplay(this.value()));
  /** Uses the locale's decimal separator (comma in German). */
  protected readonly displayText = computed(() => this.format(this.displayValue()));
  protected readonly displayMin = computed(() => this.toDisplay(this.min()));
  protected readonly displayMax = computed(() => this.toDisplay(this.max()));
  protected readonly displayStep = computed(() => {
    const unit = this.unit();
    return this.step() ?? (isLength(unit) ? inputStep(unit) : 1);
  });

  protected commit(target: HTMLInputElement): void {
    const parsed = Number.parseFloat(target.value.trim().replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      target.value = this.displayText();
      return;
    }
    this.emitDisplayValue(parsed, target);
  }

  protected stepBy(event: Event, direction: 1 | -1): void {
    event.preventDefault();
    const target = event.target as HTMLInputElement;
    const current = this.displayValue() ?? 0;
    const multiplier = (event as KeyboardEvent).shiftKey ? 10 : 1;
    this.emitDisplayValue(current + direction * multiplier * this.displayStep(), target);
  }

  private emitDisplayValue(displayValue: number, target: HTMLInputElement): void {
    const unit = this.unit();
    let base = roundTo(isLength(unit) ? fromDisplayUnit(displayValue, unit) : displayValue, BASE_DECIMALS);
    const min = this.min();
    const max = this.max();
    if (min !== null) base = Math.max(min, base);
    if (max !== null) base = Math.min(max, base);
    if (base !== this.value()) {
      this.valueChange.emit(base);
    }
    target.value = this.format(this.toDisplay(base));
  }

  private format(value: number | null): string {
    if (value === null) return '';
    const text = String(value);
    return this.i18n.locale() === 'de' ? text.replace('.', ',') : text;
  }
}
