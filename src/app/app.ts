import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { I18nService } from './core/i18n/i18n.service';
import { ThemeService } from './core/theme/theme.service';
import { ToastHostComponent } from './design-system/components';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastHostComponent],
  template: `
    <a class="ds-skip-link" href="#main">{{ i18n.t('app.skipToContent') }}</a>
    <router-outlet />
    <ds-toast-host />
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
})
export class App {
  protected readonly i18n = inject(I18nService);
  // Instantiated eagerly so the theme attribute is applied before the first render.
  protected readonly theme = inject(ThemeService);
}
