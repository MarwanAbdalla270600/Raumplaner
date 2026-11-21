import { ChangeDetectionStrategy, Component, ElementRef, input, model, viewChildren } from '@angular/core';

export interface TabItem {
  readonly id: string;
  readonly label: string;
}

/**
 * ARIA tablist with roving tabindex and arrow-key navigation. The parent renders the panel
 * for the selected tab and should give it `role="tabpanel"` and `id="<idPrefix>-panel-<tabId>"`.
 */
@Component({
  selector: 'ds-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="tablist" [attr.aria-label]="label()">
      @for (tab of tabs(); track tab.id) {
        <button
          #tabButton
          type="button"
          role="tab"
          [id]="idPrefix() + '-tab-' + tab.id"
          [attr.aria-selected]="tab.id === selected()"
          [attr.aria-controls]="idPrefix() + '-panel-' + tab.id"
          [tabIndex]="tab.id === selected() ? 0 : -1"
          (click)="selected.set(tab.id)"
          (keydown)="onKeydown($event)"
        >
          {{ tab.label }}
        </button>
      }
    </div>
  `,
  styles: `
    [role='tablist'] {
      display: flex;
      gap: var(--ds-space-1);
      border-bottom: 1px solid var(--ds-color-border);
    }
    button {
      flex: 1;
      min-height: var(--ds-touch-target);
      padding: 0 var(--ds-space-3);
      border: 0;
      border-bottom: 3px solid transparent;
      background: none;
      color: var(--ds-color-text-muted);
      font: inherit;
      font-size: var(--ds-font-size-sm);
      font-weight: var(--ds-font-weight-medium);
      cursor: pointer;
    }
    button[aria-selected='true'] {
      color: var(--ds-color-primary);
      border-bottom-color: currentColor;
    }
  `,
})
export class TabsComponent {
  readonly tabs = input.required<readonly TabItem[]>();
  readonly selected = model.required<string>();
  readonly label = input.required<string>();
  readonly idPrefix = input('ds-tabs');
  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  protected onKeydown(event: KeyboardEvent): void {
    const tabs = this.tabs();
    const index = tabs.findIndex((tab) => tab.id === this.selected());
    const offsets: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    let next: number | null = null;
    if (event.key in offsets) next = (index + offsets[event.key] + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === null) {
      return;
    }
    event.preventDefault();
    this.selected.set(tabs[next].id);
    this.buttons()[next]?.nativeElement.focus();
  }
}
