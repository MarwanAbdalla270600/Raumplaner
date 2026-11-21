import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

/**
 * Native button/anchor with design-system styling. Using an attribute selector keeps all
 * native semantics (focus, keyboard, form submit). Icon-only buttons need an aria-label.
 */
@Component({
  // Attribute selector on native elements keeps button/anchor semantics.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[dsButton], a[dsButton]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ds-button',
    '[class.ds-button--primary]': "variant() === 'primary'",
    '[class.ds-button--secondary]': "variant() === 'secondary'",
    '[class.ds-button--ghost]': "variant() === 'ghost'",
    '[class.ds-button--danger]': "variant() === 'danger'",
    '[class.ds-button--sm]': "size() === 'sm'",
    '[class.ds-button--icon]': 'iconOnly()',
    '[class.ds-button--pressed]': 'pressed() === true',
    '[attr.aria-pressed]': 'pressed()',
  },
  template: '<ng-content />',
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--ds-space-2);
      min-height: var(--ds-touch-target);
      min-width: var(--ds-touch-target);
      padding: 0 var(--ds-space-4);
      border: 1px solid transparent;
      border-radius: var(--ds-radius-md);
      font: inherit;
      font-size: var(--ds-font-size-sm);
      font-weight: var(--ds-font-weight-medium);
      line-height: 1;
      text-decoration: none;
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
      transition:
        background var(--ds-duration-fast) var(--ds-easing),
        border-color var(--ds-duration-fast) var(--ds-easing);
    }
    :host(:disabled),
    :host([aria-disabled='true']) {
      opacity: 0.45;
      cursor: not-allowed;
    }
    :host(.ds-button--primary) {
      background: var(--ds-color-primary);
      color: var(--ds-color-on-primary);
    }
    :host(.ds-button--primary:not(:disabled):hover) {
      background: var(--ds-color-primary-hover);
    }
    :host(.ds-button--secondary) {
      background: var(--ds-color-surface);
      color: var(--ds-color-text);
      border-color: var(--ds-color-border-strong);
    }
    :host(.ds-button--secondary:not(:disabled):hover),
    :host(.ds-button--ghost:not(:disabled):hover) {
      background: var(--ds-color-surface-sunken);
    }
    :host(.ds-button--ghost) {
      background: transparent;
      color: var(--ds-color-text);
    }
    :host(.ds-button--danger) {
      background: transparent;
      color: var(--ds-color-danger);
      border-color: currentColor;
    }
    :host(.ds-button--pressed) {
      background: var(--ds-color-primary-subtle);
      color: var(--ds-color-primary);
      border-color: var(--ds-color-primary);
    }
    :host(.ds-button--sm) {
      padding: 0 var(--ds-space-3);
    }
    :host(.ds-button--icon) {
      padding: 0;
    }
    @media (pointer: fine) {
      :host(.ds-button--sm) {
        min-height: var(--ds-control-height-sm);
        min-width: var(--ds-control-height-sm);
      }
    }
  `,
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('secondary');
  readonly size = input<ButtonSize>('md');
  readonly iconOnly = input(false);
  /** Toggle buttons: set to true/false to expose aria-pressed; undefined for normal buttons. */
  readonly pressed = input<boolean | undefined>(undefined);
}
