import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/project/presentation/projects-page').then((m) => m.ProjectsPage),
  },
  {
    path: 'project/:id',
    loadComponent: () => import('./features/editor/presentation/editor-page').then((m) => m.EditorPage),
  },
  {
    path: 'design-system',
    loadComponent: () => import('./design-system/showcase/design-system-page').then((m) => m.DesignSystemPage),
  },
  { path: '**', redirectTo: '' },
];
