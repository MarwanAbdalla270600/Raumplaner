import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, input, model, viewChild } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { IconComponent } from './icon';
import { uniqueId } from './unique-id';

/**
 * Modal dialog built on the native <dialog> element: focus trapping, Escape handling and
 * inert background come for free. Project footer actions with the `dsDialogActions` attribute.
 */
@Component({
  selector: 'ds-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <!-- Backdrop click is a mouse convenience; keyboard users close via Escape (native) or the close button. -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
    <dialog #dialog [attr.aria-labelledby]="titleId" (close)="open.set(false)" (click)="onBackdropClick($event)">
      <div class="panel" [class.wide]="wide()">
        <header>
          <h2 [id]="titleId">{{ heading() }}</h2>
          <button type="button" class="close" [attr.aria-label]="i18n.t('common.close')" (click)="open.set(false)">
            <ds-icon name="close" />
          </button>
        </header>
        <div class="body"><ng-content /></div>
        <footer><ng-content select="[dsDialogActions]" /></footer>
      </div>
    </dialog>
  `,
  styles: `
    dialog {
      padding: 0;
      border: 0;
      border-radius: var(--ds-radius-lg);
      background: var(--ds-color-surface-raised);
      color: var(--ds-color-text);
      box-shadow: var(--ds-shadow-lg);
      max-width: min(560px, calc(100vw - 2 * var(--ds-space-4)));
      width: 100%;
    }
    dialog::backdrop {
      background: var(--ds-color-backdrop);
    }
    .panel.wide {
      max-width: none;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--ds-space-3) var(--ds-space-3) 0 var(--ds-space-5);
    }
    h2 {
      font-size: var(--ds-font-size-lg);
    }
    .close {
      display: inline-grid;
      place-items: center;
      width: var(--ds-touch-target);
      height: var(--ds-touch-target);
      border: 0;
      border-radius: var(--ds-radius-md);
      background: none;
      color: inherit;
      cursor: pointer;
    }
    .close:hover {
      background: var(--ds-color-surface-sunken);
    }
    .body {
      padding: var(--ds-space-4) var(--ds-space-5);
      display: flex;
      flex-direction: column;
      gap: var(--ds-space-3);
    }
    footer {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: var(--ds-space-2);
      padding: 0 var(--ds-space-5) var(--ds-space-5);
    }
  `,
})
export class DialogComponent {
  protected readonly i18n = inject(I18nService);
  readonly heading = input.required<string>();
  readonly open = model(false);
  readonly wide = input(false);
  protected readonly titleId = uniqueId('ds-dialog-title');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      if (this.open() && !element.open) {
        element.showModal();
      } else if (!this.open() && element.open) {
        element.close();
      }
    });
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.open.set(false);
    }
  }
}
