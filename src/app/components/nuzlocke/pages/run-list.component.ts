import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Run, areaNames, bossesOf } from '../models';
import { GAMES } from '../nuzlocke-data';
import { NuzlockeStore } from '../services/nuzlocke.store';
import { PokedexService } from '../services/pokedex.service';
import { DisplayOptionsComponent } from '../parts/display-options.component';

interface Card {
  run: Run; game: string; done: number; total: number; alive: number; dead: number;
  bosses: number; bossTotal: number; party: string[]; updated: string;
}

function ago(ts: number): string {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} d ago` : new Date(ts).toLocaleDateString();
}

@Component({
  selector: 'nz-run-list',
  imports: [RouterLink, DisplayOptionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nz-page">
      <header class="nz-hero">
        <div>
          <p class="nz-eyebrow">PokéWorld</p>
          <h1 class="nz-hero-title">Nuzlocke Tracker</h1>
          <p class="nz-hero-sub">Every encounter matters. Every loss hurts.</p>
        </div>
        <div class="nz-hero-actions">
          <nz-display-options />
          <button type="button" class="nz-btn nz-btn-ghost" (click)="joinOpen.set(!joinOpen())">Join live run</button>
          @if (cards().length) { <button type="button" class="nz-btn nz-btn-ghost" (click)="backup()" title="Download every run as one file">Back up all</button> }
          <label class="nz-btn nz-btn-ghost">
            Import / restore
            <input type="file" accept="application/json,.json" hidden (change)="import($event)">
          </label>
          <a class="nz-btn nz-btn-primary" routerLink="new">New run</a>
        </div>
      </header>

      @if (joinOpen()) {
        <form class="nz-panel nz-join" (submit)="join($event)">
          <label class="nz-field nz-field-grow">
            <span class="nz-label">Invite code from the other player</span>
            <input class="nz-input" type="text" name="code" autocomplete="off" placeholder="abcd-efgh-jkmn" [value]="joinCode()" (input)="joinCode.set($any($event.target).value)">
          </label>
          <button type="submit" class="nz-btn nz-btn-primary" [disabled]="joinCode().replace(joinPattern, '').length < 8">Join</button>
        </form>
      }

      @if (cards().length === 0) {
        <div class="nz-panel nz-empty">
          <p class="nz-empty-title">No runs yet</p>
          <p class="nz-empty-text">Pick a game, choose Nuzlocke or Soullink, and log your first encounter.</p>
          <a class="nz-btn nz-btn-primary" routerLink="new">Start your first run</a>
        </div>
      } @else {
        <div class="nz-runs">
          @for (c of cards(); track c.run.id) {
            <article class="nz-runcard">
              <div class="nz-runcard-top">
                <span class="nz-tag" [class.nz-tag-soul]="c.run.mode === 'soullink'">{{ c.run.mode === 'soullink' ? 'Soullink' : 'Nuzlocke' }}</span>
                <span class="nz-runcard-game">{{ dex.gameLabel(c.run.game) }}</span>
              </div>
              <a class="nz-runcard-link" [routerLink]="[c.run.id]">{{ c.run.name }}</a>
              <div class="nz-runcard-party">
                @for (s of c.party; track $index) {
                  <img class="nz-runcard-sprite" [src]="dex.sprite(s)" [alt]="dex.displayName(s)" (error)="$any($event.target).style.visibility='hidden'">
                }
                @if (c.party.length === 0) { <span class="nz-runcard-none">No party yet</span> }
              </div>
              <div class="nz-progress"><span [style.width.%]="c.total ? c.done / c.total * 100 : 0"></span></div>
              <div class="nz-runcard-stats">
                <span><b class="nz-good">{{ c.alive }}</b> alive</span>
                <span><b class="nz-bad">{{ c.dead }}</b> fallen</span>
                <span><b>{{ c.bosses }}/{{ c.bossTotal }}</b> bosses</span>
                <span class="nz-runcard-when">{{ c.updated }}</span>
              </div>
              <button type="button" class="nz-runcard-del" title="Delete run" aria-label="Delete run" (click)="remove(c.run)">✕</button>
            </article>
          }
        </div>
      }
    </div>
  `,
})
export class RunListComponent {
  private readonly store = inject(NuzlockeStore);
  private readonly router = inject(Router);
  protected readonly dex = inject(PokedexService);
  protected readonly joinOpen = signal(false);
  protected readonly joinCode = signal('');
  protected readonly joinPattern = /[^a-zA-Z0-9]/g;

  protected readonly cards = computed<Card[]>(() =>
    [...this.store.runs()].sort((a, b) => b.updatedAt - a.updatedAt).map(run => {
      const areas = areaNames(run).map(n => n.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''));
      const players = run.mode === 'soullink' ? (['p1', 'p2'] as const) : (['p1'] as const);
      let alive = 0, dead = 0;
      const party: string[] = [];
      for (const [key, log] of Object.entries(run.areas)) {
        if (!areas.includes(key)) continue;
        for (const p of players) {
          const e = log[p];
          if (e?.outcome !== 'caught') continue;
          if (e.slot === 'grave') dead++; else alive++;
          if (p === 'p1' && e.slot === 'party' && party.length < 6) party.push(e.species);
        }
      }
      return {
        run, game: GAMES[run.game]?.name ?? 'Custom game',
        done: areas.filter(k => players.every(p => !!run.areas[k]?.[p])).length, total: areas.length,
        alive, dead,
        bosses: bossesOf(run).filter(b => run.bosses[b.name]?.defeated).length, bossTotal: bossesOf(run).length,
        party, updated: ago(run.updatedAt),
      };
    }));

  protected backup(): void {
    const url = URL.createObjectURL(new Blob([this.store.exportAllJson()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `nuzlocke-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected join(e: Event): void {
    e.preventDefault();
    void this.router.navigate(['/nuzlocke/join', this.joinCode().replace(this.joinPattern, '').toLowerCase()]);
  }

  protected remove(run: Run): void {
    if (confirm(`Delete "${run.name}"? This cannot be undone.`)) this.store.remove(run.id);
  }

  protected async import(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const run = this.store.importJson(await file.text());
    if (run) void this.router.navigate(['/nuzlocke', run.id]);
    else this.store.flash('That file is not a valid Nuzlocke run');
  }
}
