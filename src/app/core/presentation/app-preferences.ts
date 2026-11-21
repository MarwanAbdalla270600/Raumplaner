import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ButtonComponent, IconComponent, SelectComponent, TooltipDirective } from '../../design-system/components';
import { I18nService, Locale, LOCALES } from '../i18n/i18n.service';
import { ThemeService } from '../theme/theme.service';

/** Theme toggle and language switch, used in page headers. */
@Component({
  selector: 'app-preferences',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconComponent, SelectComponent, TooltipDirective],
  template: `
    <ds-select
      [label]="i18n.t('language.label')"
      [hideLabel]="true"
      [options]="localeOptions"
      [value]="i18n.locale()"
      (valueChange)="setLocale($event)"
    />
    <button
      dsButton
      variant="ghost"
      [iconOnly]="true"
      [attr.aria-label]="themeLabel()"
      [dsTooltip]="themeLabel()"
      (click)="theme.toggle()"
    >
      <ds-icon [name]="theme.isDark() ? 'sun' : 'moon'" />
    </button>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--ds-space-1);
    }
    ds-select {
      width: 76px;
    }
  `,
})
export class AppPreferencesComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly theme = inject(ThemeService);
  protected readonly localeOptions = LOCALES.map((locale) => ({ value: locale, label: locale.toUpperCase() }));
  protected readonly themeLabel = computed(
    () => `${this.i18n.t('theme.toggle')} (${this.i18n.t(this.theme.isDark() ? 'theme.light' : 'theme.dark')})`,
  );

  protected setLocale(value: string): void {
    if ((LOCALES as readonly string[]).includes(value)) {
      this.i18n.locale.set(value as Locale);
    }
  }
}
