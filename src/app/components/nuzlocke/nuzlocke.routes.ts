import { Routes } from '@angular/router';
import { NuzlockeComponent } from './nuzlocke.component';

export const NUZLOCKE_ROUTES: Routes = [
  {
    path: '',
    component: NuzlockeComponent,
    children: [
      { path: '', loadComponent: () => import('./pages/run-list.component').then(m => m.RunListComponent) },
      { path: 'new', loadComponent: () => import('./pages/run-create.component').then(m => m.RunCreateComponent) },
      { path: 'join/:code', loadComponent: () => import('./pages/run-join.component').then(m => m.RunJoinComponent) },
      { path: ':id', loadComponent: () => import('./pages/run-page.component').then(m => m.RunPageComponent) },
    ],
  },
];
