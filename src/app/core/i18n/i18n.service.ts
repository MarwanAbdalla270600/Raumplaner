import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { de, TranslationKey } from './translations/de';
import { en } from './translations/en';

export type Locale = 'de' | 'en';
export const LOCALES: readonly Locale[] = ['de', 'en'];
const STORAGE_KEY = 'raumplaner.locale';
const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = { de, en };
const INTL_LOCALES: Record<Locale, string> = { de: 'de-DE', en: 'en-GB' };

export type TranslationParams = Readonly<Record<string, string | number>>;

export function interpolate(template: string, params: TranslationParams = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

function readStoredLocale(): Locale | null {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    return stored === 'de' || stored === 'en' ? stored : null;
  } catch {
    return null;
  }
}

/** Runtime-switchable translations. Reading `t()` inside a template tracks the locale signal. */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);
  readonly locale = signal<Locale>(readStoredLocale() ?? 'de');
  readonly intlLocale = computed(() => INTL_LOCALES[this.locale()]);

  constructor() {
    effect(() => {
      const locale = this.locale();
      this.document.documentElement.lang = locale;
      try {
        globalThis.localStorage?.setItem(STORAGE_KEY, locale);
      } catch {
        /* storage unavailable – ignore */
      }
    });
  }

  t(key: TranslationKey, params?: TranslationParams): string {
    return interpolate(DICTIONARIES[this.locale()][key] ?? key, params);
  }

  /** Translates keys that come from data (e.g. command labels); falls back to the raw key. */
  tryT(key: string, params?: TranslationParams): string {
    const dictionary = DICTIONARIES[this.locale()] as Record<string, string>;
    return key in dictionary ? interpolate(dictionary[key], params) : key;
  }

  formatDate(iso: string): string {
    return new Intl.DateTimeFormat(this.intlLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  }
}
