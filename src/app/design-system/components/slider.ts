import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { uniqueId } from './unique-id';

@Component({
  selector: 'ds-slider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <label class="label" [for]="id">{{ label() }}</label>
      <output class="value" [for]="id">{{ value() }}{{ suffix() }}</output>
    </div>
    <input
      [id]="id"
      type="range"
      [min]="min()"
      [max]="max()"
      [step]="step()"
      [value]="value()"
      (input)="value.set(+$any($event.target).value)"
      (change)="committed.emit(+$any($event.target).value)"
    />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--ds-space-1);
    }
    .row {
      display: flex;
      justify-content: space-between;
      font-size: var(--ds-font-size-xs);
    }
    .label {
      font-weight: var(--ds-font-weight-medium);
      color: var(--ds-color-text-muted);
    }
    .value {
      font-family: var(--ds-font-mono);
    }
    input {
      width: 100%;
      min-height: var(--ds-touch-target);
      accent-color: var(--ds-color-primary);
    }
  `,
})
export class SliderComponent {
  readonly label = input.required<string>();
  readonly min = input(0);
  readonly max = input(100);
  readonly step = input(1);
  readonly suffix = input('');
  readonly value = model(0);
  readonly committed = output<number>();
  protected readonly id = uniqueId('ds-slider');
}
