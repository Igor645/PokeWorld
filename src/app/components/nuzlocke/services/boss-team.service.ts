import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { BossFight } from '../boss-teams';

/** Loads the (fairly large) generated boss roster file on demand, as its own chunk. */
@Injectable({ providedIn: 'root' })
export class BossTeamService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly data = signal<Record<string, Record<string, BossFight[]>> | null>(null);
  private started = false;

  load(): void {
    if (!this.browser || this.started) return;
    this.started = true;
    void import('../boss-teams').then(m => this.data.set(m.BOSS_TEAMS));
  }

  /** null until loaded. */
  fights(game: string, milestone: string): BossFight[] | null {
    const d = this.data();
    return d ? (d[game]?.[milestone] ?? []) : null;
  }
}
