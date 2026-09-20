import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { NuzlockeStore } from '../services/nuzlocke.store';
import { SyncService } from '../services/sync.service';

@Component({
  selector: 'nz-share',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.run(); as r) {
      <div class="nz-share">
        @if (!r.share) {
          <button type="button" class="nz-btn nz-btn-ghost nz-btn-sm" (click)="start()" title="Let a second player edit this run with you, live">Share live</button>
        } @else {
          <button type="button" class="nz-btn nz-btn-ghost nz-btn-sm nz-live" [class.nz-live-on]="sync.status() === 'live'"
                  [class.nz-live-bad]="sync.status() === 'error'" (click)="open.set(!open())" [attr.aria-expanded]="open()">
            <i class="nz-live-dot"></i> {{ label() }}
          </button>
          @if (open()) {
            <div class="nz-share-pop" role="dialog" aria-label="Live sharing">
              <div class="nz-share-row">
                <span class="nz-eyebrow">Invite code</span>
                <code class="nz-share-code">{{ code() }}</code>
                <div class="nz-share-btns">
                  <button type="button" class="nz-btn nz-btn-ghost nz-btn-sm" (click)="copy(code(), 'Code copied')">Copy code</button>
                  <button type="button" class="nz-btn nz-btn-ghost nz-btn-sm" (click)="copy(link(), 'Invite link copied')">Copy link</button>
                </div>
              </div>

              <label class="nz-field">
                <span class="nz-label">Your name (shown to the other player)</span>
                <input class="nz-input" type="text" maxlength="24" placeholder="e.g. Sam" [value]="sync.displayName()" (change)="sync.setName($any($event.target).value)">
              </label>

              <div class="nz-share-status">
                <span class="nz-eyebrow">Online now</span>
                <ul class="nz-share-peers">
                  <li><i class="nz-live-dot nz-live-on"></i> {{ sync.displayName() || 'You' }} (you)</li>
                  @for (n of sync.peers(); track $index) { <li><i class="nz-live-dot nz-live-on"></i> {{ n }}</li> }
                </ul>
                @if (sync.error()) { <p class="nz-death-note">{{ sync.error() }}</p> }
                @else if (sync.status() === 'live' && sync.peers().length === 0) { <p class="nz-section-hint">Waiting for the other player to join with the code.</p> }
              </div>

              <p class="nz-share-help">
                Both of you need this run open at the same time to sync; each keeps a full local copy, so you can also play offline and it
                merges when you reconnect. Anyone with the code can edit, so only share it with your partner. The connection is
                peer-to-peer (WebRTC) and uses PeerJS's public signaling server to introduce you.
              </p>
              <button type="button" class="nz-btn nz-btn-danger nz-btn-sm" (click)="stop()">Stop sharing</button>
            </div>
          }
        }
      </div>
    }
  `,
})
export class SharePanelComponent {
  protected readonly store = inject(NuzlockeStore);
  protected readonly sync = inject(SyncService);
  protected readonly open = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  @HostListener('document:keydown.escape') protected onEscape(): void { this.open.set(false); }

  @HostListener('document:click', ['$event']) protected onOutside(e: Event): void {
    const t = e.target as Node;
    if (this.open() && t.isConnected && !this.host.nativeElement.contains(t)) this.open.set(false);
  }

  private readonly key = computed(() => this.store.run()?.share?.key ?? '');
  protected readonly code = computed(() => (this.key().match(/.{1,4}/g) ?? []).join('-'));
  protected readonly link = computed(() => `${location.origin}/nuzlocke/join/${this.key()}`);

  protected readonly label = computed(() => {
    switch (this.sync.status()) {
      case 'live': return this.sync.peers().length ? `Live · ${this.sync.peers().length + 1} editing` : 'Live · waiting';
      case 'error': return 'Sync problem';
      default: return 'Connecting…';
    }
  });

  protected start(): void {
    this.store.enableShare();
    this.open.set(true);
  }

  protected stop(): void {
    if (confirm('Stop sharing? The other player keeps their copy but will no longer receive your changes.')) {
      this.store.disableShare();
      this.open.set(false);
    }
  }

  protected async copy(text: string, message: string): Promise<void> {
    try { await navigator.clipboard.writeText(text); this.store.flash(message); }
    catch { this.store.flash('Could not access the clipboard'); }
  }
}
