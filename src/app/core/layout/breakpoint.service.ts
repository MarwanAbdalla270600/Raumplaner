import { DestroyRef, inject, Injectable, signal, Signal } from '@angular/core';

/** Breakpoints in px, mirrored in design-system/tokens/_breakpoints.scss. */
export const BREAKPOINTS = { tablet: 768, desktop: 1100 } as const;

function mediaSignal(query: string, destroyRef: DestroyRef): Signal<boolean> {
  const media = globalThis.matchMedia?.(query);
  const state = signal(media?.matches ?? false);
  if (media) {
    const listener = (event: MediaQueryListEvent): void => state.set(event.matches);
    media.addEventListener('change', listener);
    destroyRef.onDestroy(() => media.removeEventListener('change', listener));
  }
  return state.asReadonly();
}

@Injectable({ providedIn: 'root' })
export class BreakpointService {
  private readonly destroyRef = inject(DestroyRef);
  readonly isMobile = mediaSignal(`(max-width: ${BREAKPOINTS.tablet - 1}px)`, this.destroyRef);
  readonly isDesktop = mediaSignal(`(min-width: ${BREAKPOINTS.desktop}px)`, this.destroyRef);
  readonly prefersReducedMotion = mediaSignal('(prefers-reduced-motion: reduce)', this.destroyRef);
}
