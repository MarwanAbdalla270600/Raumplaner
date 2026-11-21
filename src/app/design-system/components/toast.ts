import { ChangeDetectionStrategy, Component, inject, Injectable, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { IconComponent } from './icon';

export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly kind: ToastKind;
}

export const TOAST_DURATION_MS = 3500;
const MAX_VISIBLE_TOASTS = 3;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly toasts = signal<readonly Toast[]>([]);

  show(message: string, kind: ToastKind = 'info', duration = TOAST_DURATION_MS): void {
    const toast: Toast = { id: ++this.nextId, message, kind };
    this.toasts.update((list) => [...list, toast].slice(-MAX_VISIBLE_TOASTS));
    setTimeout(() => this.dismiss(toast.id), duration);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }
}

@Component({
  selector: 'ds-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="region" role="status" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class]="toast.kind">
          <ds-icon [name]="toast.kind === 'error' ? 'warning' : 'check'" />
          <span>{{ toast.message }}</span>
          <button type="button" [attr.aria-label]="i18n.t('common.close')" (click)="toasts.dismiss(toast.id)">
            <ds-icon name="close" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .region {
      position: fixed;
      left: 50%;
      bottom: calc(var(--ds-space-5) + env(safe-area-inset-bottom));
      transform: translateX(-50%);
      z-index: var(--ds-z-toast);
      display: flex;
      flex-direction: column;
      gap: var(--ds-space-2);
      width: min(420px, calc(100vw - 2 * var(--ds-space-4)));
      pointer-events: none;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: var(--ds-space-2);
      padding: var(--ds-space-2) var(--ds-space-2) var(--ds-space-2) var(--ds-space-4);
      border-radius: var(--ds-radius-md);
      background: var(--ds-gray-800);
      color: var(--ds-gray-50);
      box-shadow: var(--ds-shadow-lg);
      font-size: var(--ds-font-size-sm);
      pointer-events: auto;
      animation: enter var(--ds-duration-normal) var(--ds-easing);
    }
    .toast.error ds-icon {
      color: var(--ds-red-300);
    }
    .toast.success ds-icon {
      color: var(--ds-green-300);
    }
    span {
      flex: 1;
    }
    button {
      display: inline-grid;
      place-items: center;
      width: var(--ds-touch-target);
      height: var(--ds-touch-target);
      border: 0;
      background: none;
      color: inherit;
      cursor: pointer;
    }
    @keyframes enter {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }
  `,
})
export class ToastHostComponent {
  protected readonly toasts = inject(ToastService);
  protected readonly i18n = inject(I18nService);
}
