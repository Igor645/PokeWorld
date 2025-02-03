import { Component, OnInit, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MainLayoutComponent } from './components/main-layout/main-layout.component';
import { Router, NavigationEnd } from '@angular/router';
import { ViewportScroller } from '@angular/common';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, MainLayoutComponent],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit{
  constructor(private router: Router, @Inject(PLATFORM_ID) private platformId: any) {}

  ngOnInit() {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        if (isPlatformBrowser(this.platformId)) {
            window.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        }
      }
    });
  }
  
}