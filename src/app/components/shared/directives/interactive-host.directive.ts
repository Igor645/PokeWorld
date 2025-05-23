import { Directive, HostBinding, HostListener, Input } from '@angular/core';

import { Router } from '@angular/router';

@Directive({
    selector: '[appInteractiveHost]',
    standalone: true
})
export class InteractiveHostDirective {
    @HostBinding('attr.tabindex') tabindex = 0;
    @HostBinding('attr.role') role = 'link';

    @Input('appInteractiveHost') href!: string | any[];
    @Input() target: '_blank' | '_self' = '_self';

    constructor(private router: Router) { }

    private isExternalLink(url: string): boolean {
        return /^https?:\/\//.test(url);
    }

    private openInNewTab(url: string): void {
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    private handleNavigation(openInNewTab: boolean): void {
        if (!this.href) return;

        if (typeof this.href === 'string') {
            if (this.isExternalLink(this.href)) {
                if (this.target === '_blank' || openInNewTab) {
                    this.openInNewTab(this.href);
                } else {
                    window.location.href = this.href;
                }
            } else {
                const nav = [this.href];
                if (openInNewTab) {
                    const fullUrl = this.router.serializeUrl(this.router.createUrlTree(nav));
                    this.openInNewTab(fullUrl);
                } else {
                    this.router.navigate(nav);
                }
            }
        } else if (Array.isArray(this.href)) {
            if (openInNewTab) {
                const fullUrl = this.router.serializeUrl(this.router.createUrlTree(this.href));
                this.openInNewTab(fullUrl);
            } else {
                this.router.navigate(this.href);
            }
        }
    }

    @HostListener('mousedown', ['$event'])
    handleMouseDown(event: MouseEvent): void {
        if (event.button === 1) {
            event.preventDefault();
            this.handleNavigation(true);
        }
    }

    @HostListener('click', ['$event'])
    handleClick(event: MouseEvent): void {
        if (event.button !== 0) return;

        const openInNewTab = event.ctrlKey || event.metaKey;
        this.handleNavigation(openInNewTab);
        event.preventDefault();
    }

    @HostListener('keydown', ['$event'])
    handleKeydown(event: KeyboardEvent): void {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            const openInNewTab = event.ctrlKey || event.metaKey;
            this.handleNavigation(openInNewTab);
        }
    }
}
