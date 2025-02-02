import { Component, HostListener, Inject, PLATFORM_ID, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-scroll-to-top',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scroll-to-top.component.html',
  styleUrls: ['./scroll-to-top.component.css'],
})
export class ScrollToTopComponent implements AfterViewInit, OnDestroy {
  showScrollToTopButton = false;
  private ticking = false;

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.addScrollListener();
    }
  }

  ngOnDestroy() {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener("scroll", this.onScroll);
    }
  }

  /**
   * Adds optimized scroll listener
   */
  private addScrollListener() {
    window.addEventListener("scroll", this.onScroll);
  }

  /**
   * Handles the scroll event
   */
  private onScroll = () => {
    const currentScrollPosition = window.scrollY;

    if (!this.ticking) {
      window.requestAnimationFrame(() => {
        this.showScrollToTopButton = currentScrollPosition > 300;
        this.toggleScrollToTopButton(this.showScrollToTopButton);
        this.ticking = false;
      });

      this.ticking = true;
    }
  };

  /**
   * Scrolls smoothly to the top
   */
  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Toggles the visibility of the button
   */
  private toggleScrollToTopButton(show: boolean) {
    const scrollToTopButton = document.querySelector('.scroll-to-top');
    if (!scrollToTopButton) return;

    if (show) {
      scrollToTopButton.classList.remove('hide');
      scrollToTopButton.classList.add('show');
    } else {
      scrollToTopButton.classList.remove('show');
      scrollToTopButton.classList.add('hide');
    }
  }
}
