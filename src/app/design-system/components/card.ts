import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ds-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.interactive]': 'interactive()' },
  template: `
    @if (heading()) {
      <h3 class="heading">{{ heading() }}</h3>
    }
    <ng-content />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--ds-space-3);
      padding: var(--ds-space-4);
      background: var(--ds-color-surface);
      border: 1px solid var(--ds-color-border);
      border-radius: var(--ds-radius-lg);
      box-shadow: var(--ds-shadow-sm);
    }
    :host(.interactive) {
      transition: box-shadow var(--ds-duration-fast) var(--ds-easing);
    }
    :host(.interactive:hover) {
      box-shadow: var(--ds-shadow-md);
    }
    .heading {
      font-size: var(--ds-font-size-md);
    }
  `,
})
export class CardComponent {
  readonly heading = input('');
  readonly interactive = input(false);
}
