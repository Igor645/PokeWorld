import { Component, DestroyRef, ViewChild, inject } from '@angular/core';
import { NavDrawerComponent, NavItem } from '../nav-drawer/nav-drawer.component';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CommonModule } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { ScrollToTopComponent } from '../scroll-to-top/scroll-to-top.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, NavDrawerComponent, ScrollToTopComponent, MatIcon],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css'],
})
export class MainLayoutComponent {
  @ViewChild('drawer') drawer!: NavDrawerComponent;

  isMainPage = true;

  navItems: NavItem[] = [
    { type: 'link', label: 'Home', route: '/', icon: 'home' },
    {
      type: 'group', label: 'Games', icon: 'videogame_asset',
      children: [
        { label: 'Name \'em All', route: '/quiz', icon: 'quiz' },
        { label: 'Pokéle', route: '/pokele', icon: 'help_outline' },
      ]
    },
  ];

  private readonly destroyRef = inject(DestroyRef);

  constructor(private router: Router) {
    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(e => {
        if (e instanceof NavigationEnd) this.isMainPage = e.urlAfterRedirects === '/';
      });
  }
}
