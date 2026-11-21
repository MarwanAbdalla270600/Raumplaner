import { ChangeDetectionStrategy, Component, input, model, signal } from '@angular/core';
import { IconComponent } from './icon';

/** Vertical drag distance (px) needed to toggle the sheet. */
const SWIPE_THRESHOLD_PX = 40;

/**
 * Mobile bottom sheet with a collapsed (peek) and expanded state. The handle toggles on tap,
 * keyboard (Enter/Space) and vertical swipe.
 */
@Component({
  selector: 'ds-bottom-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { '[class.expanded]': 'expanded()' },
  template: `
    <section [attr.aria-label]="heading()">
      <button
        type="button"
        class="handle"
        [attr.aria-expanded]="expanded()"
        (click)="toggle()"
        (pointerdown)="startSwipe($event)"
        (pointerup)="endSwipe($event)"
      >
        <span class="grip" aria-hidden="true"></span>
        <span class="title">{{ heading() }}</span>
        <ds-icon [name]="expanded() ? 'chevronDown' : 'chevronUp'" />
      </button>
      <div class="content" [attr.inert]="expanded() ? null : ''">
        <ng-content />
      </div>
    </section>
  `,
  styles: `
    :host {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: var(--ds-z-sheet);
      display: block;
      transform: translateY(calc(100% - var(--peek, 64px)));
      transition: transform var(--ds-duration-normal) var(--ds-easing);
      max-height: 70vh;
      background: var(--ds-color-surface-raised);
      border-radius: var(--ds-radius-lg) var(--ds-radius-lg) 0 0;
      box-shadow: var(--ds-shadow-lg);
      padding-bottom: env(safe-area-inset-bottom);
    }
    :host(.expanded) {
      transform: translateY(0);
    }
    section {
      display: flex;
      flex-direction: column;
      max-height: 70vh;
    }
    .handle {
      display: flex;
      align-items: center;
      gap: var(--ds-space-3);
      position: relative;
      min-height: 64px;
      padding: var(--ds-space-3) var(--ds-space-4) 0;
      border: 0;
      background: none;
      color: var(--ds-color-text);
      font: inherit;
      font-weight: var(--ds-font-weight-bold);
      cursor: pointer;
      touch-action: none;
    }
    .grip {
      position: absolute;
      top: 8px;
      left: 50%;
      width: 40px;
      height: 4px;
      margin-left: -20px;
      border-radius: var(--ds-radius-full);
      background: var(--ds-color-border-strong);
    }
    .title {
      flex: 1;
      text-align: left;
    }
    .content {
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 0 var(--ds-space-4) var(--ds-space-4);
    }
  `,
})
export class BottomSheetComponent {
  readonly heading = input.required<string>();
  readonly expanded = model(false);
  private readonly swipeStartY = signal<number | null>(null);
  private suppressClick = false;

  protected toggle(): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    this.expanded.update((value) => !value);
  }

  protected startSwipe(event: PointerEvent): void {
    this.swipeStartY.set(event.clientY);
  }

  protected endSwipe(event: PointerEvent): void {
    const start = this.swipeStartY();
    this.swipeStartY.set(null);
    if (start === null) {
      return;
    }
    const delta = event.clientY - start;
    if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) {
      this.expanded.set(delta < 0);
      this.suppressClick = true;
    }
  }
}
