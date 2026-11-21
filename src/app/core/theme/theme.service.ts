import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'raumplaner.theme';

function initialTheme(): Theme {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly theme = signal<Theme>(initialTheme());
  readonly isDark = computed(() => this.theme() === 'dark');

  constructor() {
    effect(() => {
      const theme = this.theme();
      this.document.documentElement.dataset['theme'] = theme;
      try {
        globalThis.localStorage?.setItem(STORAGE_KEY, theme);
      } catch {
        /* ignore */
      }
    });
  }

  toggle(): void {
    this.theme.update((theme) => (theme === 'dark' ? 'light' : 'dark'));
  }
}
