import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';
import { uniqueId } from './unique-id';

const TOOLTIP_OFFSET_PX = 8;
const SHOW_DELAY_MS = 350;

/**
 * Lightweight tooltip shown on hover and keyboard focus, linked via aria-describedby.
 * Hidden with Escape (WCAG 1.4.13).
 */
@Directive({
  selector: '[dsTooltip]',
  host: {
    '(mouseenter)': 'scheduleShow()',
    '(mouseleave)': 'hide()',
    '(focusin)': 'show()',
    '(focusout)': 'hide()',
    '(keydown.escape)': 'hide()',
    '(pointerdown)': 'hide()',
  },
})
export class TooltipDirective {
  readonly dsTooltip = input.required<string>();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly id = uniqueId('ds-tooltip');
  private element: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.hide());
  }

  protected scheduleShow(): void {
    this.clearTimer();
    this.timer = setTimeout(() => this.show(), SHOW_DELAY_MS);
  }

  protected show(): void {
    this.clearTimer();
    const text = this.dsTooltip();
    if (!text || this.element) {
      return;
    }
    const tooltip = this.document.createElement('div');
    tooltip.id = this.id;
    tooltip.role = 'tooltip';
    tooltip.className = 'ds-tooltip';
    tooltip.textContent = text;
    this.document.body.appendChild(tooltip);
    this.position(tooltip);
    this.host.nativeElement.setAttribute('aria-describedby', this.id);
    this.element = tooltip;
  }

  protected hide(): void {
    this.clearTimer();
    this.element?.remove();
    this.element = null;
    this.host.nativeElement.removeAttribute('aria-describedby');
  }

  private position(tooltip: HTMLElement): void {
    const rect = this.host.nativeElement.getBoundingClientRect();
    const width = tooltip.offsetWidth;
    const viewportWidth = this.document.documentElement.clientWidth;
    const left = Math.min(
      Math.max(TOOLTIP_OFFSET_PX, rect.left + rect.width / 2 - width / 2),
      viewportWidth - width - TOOLTIP_OFFSET_PX,
    );
    const below = rect.bottom + TOOLTIP_OFFSET_PX;
    const top =
      below + tooltip.offsetHeight > window.innerHeight ? rect.top - tooltip.offsetHeight - TOOLTIP_OFFSET_PX : below;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
