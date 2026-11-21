import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Zoneless: change detection is driven exclusively by signals and template events.
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
  ],
};
