import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { uniqueId } from './unique-id';

@Component({
  selector: 'ds-color-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="ds-field__label" [for]="id">{{ label() }}</label>
    <div class="ds-field__control">
      <input
        class="swatch"
        [id]="id"
        type="color"
        [value]="value()"
        (change)="valueChange.emit($any($event.target).value)"
      />
      <span class="ds-field__suffix code">{{ value() }}</span>
    </div>
  `,
  styleUrl: './field.scss',
  styles: `
    .swatch {
      flex: 0 0 auto;
      width: 56px;
      padding: 4px !important;
      cursor: pointer;
    }
    .code {
      font-family: var(--ds-font-mono);
    }
  `,
})
export class ColorFieldComponent {
  readonly label = input.required<string>();
  readonly value = input('#000000');
  readonly valueChange = output<string>();
  protected readonly id = uniqueId('ds-color');
}
