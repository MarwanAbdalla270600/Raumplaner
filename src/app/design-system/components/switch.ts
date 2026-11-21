import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

@Component({
  selector: 'ds-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" role="switch" [attr.aria-checked]="checked()" (click)="checked.set(!checked())">
      <span class="track" aria-hidden="true"><span class="thumb"></span></span>
      <span class="label">{{ label() }}</span>
    </button>
  `,
  styles: `
    button {
      display: inline-flex;
      align-items: center;
      gap: var(--ds-space-2);
      min-height: var(--ds-touch-target);
      padding: 0;
      border: 0;
      background: none;
      color: var(--ds-color-text);
      font: inherit;
      font-size: var(--ds-font-size-sm);
      cursor: pointer;
    }
    .track {
      position: relative;
      width: 40px;
      height: 24px;
      border-radius: var(--ds-radius-full);
      background: var(--ds-color-border-strong);
      transition: background var(--ds-duration-fast) var(--ds-easing);
    }
    .thumb {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--ds-color-surface);
      box-shadow: var(--ds-shadow-sm);
      transition: transform var(--ds-duration-fast) var(--ds-easing);
    }
    [aria-checked='true'] .track {
      background: var(--ds-color-primary);
    }
    [aria-checked='true'] .thumb {
      transform: translateX(16px);
    }
  `,
})
export class SwitchComponent {
  readonly label = input.required<string>();
  readonly checked = model(false);
}
