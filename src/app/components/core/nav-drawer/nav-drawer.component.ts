import { Component, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';

import { A11yModule } from '@angular/cdk/a11y';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { PokeworldSearchComponent } from '../../search/pokeworld-search/pokeworld-search.component';
import { SettingsComponent } from '../settings/settings.component';
import { filter } from 'rxjs/operators';

export type NavItem =
  | { type: 'link'; label: string; route: string; icon?: string; external?: boolean }
  | { type: 'group'; label: string; icon?: string; children: Array<{ label: string; route: string; icon?: string; external?: boolean }> };

@Component({
  selector: 'app-nav-drawer',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, A11yModule, MatIconModule, SettingsComponent, PokeworldSearchComponent],
  templateUrl: './nav-drawer.component.html',
  styleUrls: ['./nav-drawer.component.css'],
})
export class NavDrawerComponent {
  @Input() items: NavItem[] = [];
  @Input() closeOnNavigate = true;
  @Output() openedChange = new EventEmitter<boolean>();

  open = false;
  expanded = new Set<string>();

  private router = inject(Router);

  constructor() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      if (this.open && this.closeOnNavigate) this.close();
    });
  }

  toggle() { this.open ? this.close() : this.openDrawer(); }
  openDrawer() { if (!this.open) { this.open = true; this.openedChange.emit(true); } }
  close() { if (this.open) { this.open = false; this.openedChange.emit(false); } }

  toggleGroup(key: string) { this.expanded.has(key) ? this.expanded.delete(key) : this.expanded.add(key); }
  isExpanded(key: string) { return this.expanded.has(key); }
  onGroupKey(e: KeyboardEvent, key: string) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggleGroup(key); }
  }

  handleLinkClick(item: { external?: boolean }) {
    if (item.external) this.close();
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && this.open) { e.preventDefault(); this.close(); }
  }
}
