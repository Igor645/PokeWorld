import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { DexOverviewComponent } from '../../dex/dex-overview/dex-overview.component';
import { SettingsComponent } from '../settings/settings.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, DexOverviewComponent, SettingsComponent],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css'],
})
export class MainLayoutComponent {
  isMainPage = true;

  constructor(private router: Router) {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.isMainPage = event.urlAfterRedirects === '/';
      }
    });
  }
}
