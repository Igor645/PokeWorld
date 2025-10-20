import { Component, ViewChild } from '@angular/core';
import { NavDrawerComponent, NavItem } from '../nav-drawer/nav-drawer.component';
import { NavigationEnd, Router, RouterModule } from '@angular/router';

import { CommonModule } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { PokeworldSearchComponent } from '../../search/pokeworld-search/pokeworld-search.component';
import { ScrollToTopComponent } from '../scroll-to-top/scroll-to-top.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, NavDrawerComponent, PokeworldSearchComponent, ScrollToTopComponent, MatIcon],
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
        { label: 'Memory Match', route: '/games/memory' },
        { label: 'Trivia', route: '/games/trivia' },
        { label: 'Battle Sim', route: '/games/battle' },
      ]
    },
  ];

  constructor(private router: Router) {
    this.router.events.subscribe(e => {
      if (e instanceof NavigationEnd) this.isMainPage = e.urlAfterRedirects === '/';
    });
  }
}
