import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { uniqueId } from './unique-id';

export interface SelectOption<T extends string = string> {
  readonly value: T;
  readonly label: string;
}

@Component({
  selector: 'ds-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="ds-field__label" [class.ds-visually-hidden]="hideLabel()" [for]="id">{{ label() }}</label>
    <div class="ds-field__control">
      <select [id]="id" [value]="value()" (change)="value.set($any($event.target).value)">
        @for (option of options(); track option.value) {
          <option [value]="option.value" [selected]="option.value === value()">{{ option.label }}</option>
        }
      </select>
    </div>
  `,
  styleUrl: './field.scss',
})
export class SelectComponent {
  readonly label = input.required<string>();
  readonly options = input.required<readonly SelectOption[]>();
  readonly value = model<string>('');
  readonly hideLabel = input(false);
  protected readonly id = uniqueId('ds-select');
}
