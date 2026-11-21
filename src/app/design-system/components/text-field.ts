import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { uniqueId } from './unique-id';

@Component({
  selector: 'ds-text-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="ds-field__label" [for]="id">{{ label() }}</label>
    <div class="ds-field__control">
      <input
        [id]="id"
        [type]="type()"
        [value]="value()"
        [attr.placeholder]="placeholder() || null"
        [attr.autocomplete]="autocomplete()"
        [required]="required()"
        (input)="value.set($any($event.target).value)"
        (change)="committed.emit($any($event.target).value)"
        (keydown.enter)="committed.emit($any($event.target).value)"
      />
    </div>
  `,
  styleUrl: './field.scss',
})
export class TextFieldComponent {
  readonly label = input.required<string>();
  readonly value = model('');
  readonly type = input<'text' | 'search'>('text');
  readonly placeholder = input('');
  readonly autocomplete = input('off');
  readonly required = input(false);
  /** Emits when the user finishes editing (change/enter). */
  readonly committed = output<string>();
  protected readonly id = uniqueId('ds-text');
}
