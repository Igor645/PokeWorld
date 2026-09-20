import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { TYPE_COLORS } from '../models';
import { NuzlockeStore } from '../services/nuzlocke.store';
import { PokedexService } from '../services/pokedex.service';
import { BossTeamService } from '../services/boss-team.service';
import { BossTeamComponent } from './boss-team.component';
import { EncounterCellComponent } from './encounter-cell.component';

type Filter = 'all' | 'todo' | 'done';

const ROLE: Record<string, string> = {
  gym: 'Gym Leader', rival: 'Rival', elite4: 'Elite Four', champion: 'Champion', boss: 'Boss',
};

@Component({
  selector: 'nz-area-board',
  imports: [EncounterCellComponent, BossTeamComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nz-toolbar">
      <div class="nz-seg" role="group" aria-label="Filter areas">
        @for (f of filters; track f.id) {
          <button type="button" class="nz-seg-btn" [class.nz-seg-on]="filter() === f.id" (click)="filter.set(f.id)">{{ f.label }}</button>
        }
      </div>
      <input class="nz-input nz-search" type="search" placeholder="Find an area…" aria-label="Find an area"
             [value]="text()" (input)="text.set($any($event.target).value)">
      <span class="nz-toolbar-info">{{ store.progress().done }} of {{ store.progress().total }} areas logged
        <span class="nz-kbd-hint"><kbd>/</kbd> log · <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo</span></span>
      <button type="button" class="nz-btn nz-btn-ghost nz-btn-sm" (click)="jump()">Jump to current</button>
    </div>

    @if (store.areaSteps().length === 0) {
      <div class="nz-empty">
        <p class="nz-empty-title">No areas yet</p>
        <p class="nz-empty-text">Add the first area of your game to start logging encounters.</p>
      </div>
    }

    <ol class="nz-timeline">
      @for (s of visible(); track s.key) {
        @if (s.kind === 'area') {
          @let current = store.frontier() === s.key;
          <li class="nz-step" [id]="'nz-area-' + s.key" [class.nz-step-current]="current" [class.nz-step-done]="isDone(s.key)">
            <span class="nz-node" aria-hidden="true"></span>
            <div class="nz-area">
              <div class="nz-area-head">
                <span class="nz-area-name" [title]="s.name">{{ label(s.name) }}</span>
                @if (current) { <span class="nz-tag nz-tag-now">Now</span> }
                @if (canSkipAbove(s.key)) {
                  <button type="button" class="nz-icon-btn nz-skip-btn" title="Skip every unlogged encounter above this area" (click)="store.skipBefore(s.key)">⤒</button>
                }
                @if (isBonus(s.name)) { <span class="nz-tag nz-tag-soul">Bonus</span> }
                @if (isBonus(s.name)) {
                  <button type="button" class="nz-icon-btn" title="Remove this area" (click)="store.removeArea(s.name)">✕</button>
                }
              </div>
              <div class="nz-area-cells" [class.nz-duo]="store.isSoullink()">
                @for (p of store.players(); track p; let first = $first) {
                  <div class="nz-cell-col">
                    @if (store.isSoullink()) { <span class="nz-player-label">{{ store.playerName(p) }}</span> }
                    <nz-encounter-cell [key]="s.key" [area]="s.name" [player]="p" />
                  </div>
                  @if (store.isSoullink() && first) {
                    <div class="nz-linkmark" [class]="'nz-linkmark nz-link-' + store.linkState(s.key)"
                         [title]="linkTitle(s.key)"><span>{{ linkGlyph(s.key) }}</span></div>
                  }
                }
              </div>
            </div>
          </li>
        } @else {
          @let b = s.boss;
          @let done = store.isDefeated(b.name);
          <li class="nz-step nz-step-boss" [class.nz-step-done]="done">
            <span class="nz-node nz-node-boss" aria-hidden="true"></span>
            <div class="nz-boss" [class.nz-boss-done]="done" [class.nz-boss-next]="store.nextBoss()?.name === b.name"
                 [style.--boss]="color(b.type)">
              <img class="nz-boss-ace" [src]="dex.sprite(b.acePokemon)" alt="" (error)="$any($event.target).style.display='none'">
              <div class="nz-boss-main">
                <span class="nz-boss-role">{{ role(b.role) }}@if (store.nextBoss()?.name === b.name) { · Next }@if (!done && ready(b.afterRoute)) { · Ready to fight }</span>
                <span class="nz-boss-name">{{ b.name }}</span>
                <span class="nz-boss-sub">
                  @if (b.badge) { {{ b.badge }} · }Ace {{ dex.displayName(b.acePokemon) }}
                </span>
                <button type="button" class="nz-link-btn nz-prep-btn" (click)="toggleTeam(b.name, b.acePokemon)">
                  {{ prepOpen().has(b.name) ? 'Hide team' : 'Team & matchups' }}
                </button>
              </div>
              <label class="nz-boss-cap">
                <span class="nz-eyebrow">Level cap</span>
                <input class="nz-cap-input" type="number" min="1" max="100" [value]="store.bossCap(b)"
                       (change)="store.setBossCap(b.name, +$any($event.target).value)" aria-label="Level cap for {{ b.name }}">
              </label>
              <button type="button" class="nz-boss-btn" [class.nz-boss-btn-on]="done" (click)="store.toggleBoss(b.name)">
                {{ done ? '✓ Defeated' : 'Mark defeated' }}
              </button>
              @if (done) { <span class="nz-stamp" aria-hidden="true">Cleared</span> }
            </div>
            @if (prepOpen().has(b.name)) { <nz-boss-team [boss]="b" /> }
          </li>
        }
      }
    </ol>

    @if (store.run()) {
      <div class="nz-add-area">
        <input class="nz-input" type="text" [placeholder]="store.run()?.game === 'custom' ? 'Add an area or route…' : 'Add a bonus encounter: gift, static, trade…'" [value]="newArea()"
               (input)="newArea.set($any($event.target).value)" (keydown.enter)="addArea()">
        <button type="button" class="nz-btn nz-btn-primary nz-btn-sm" [disabled]="!newArea().trim()" (click)="addArea()">{{ store.run()?.game === 'custom' ? 'Add area' : 'Add bonus' }}</button>
      </div>
    }
  `,
})
export class AreaBoardComponent {
  protected readonly store = inject(NuzlockeStore);
  protected readonly dex = inject(PokedexService);
  private readonly doc = inject(DOCUMENT);
  private readonly teams = inject(BossTeamService);

  protected readonly filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' }, { id: 'todo', label: 'To do' }, { id: 'done', label: 'Logged' },
  ];
  protected readonly filter = signal<Filter>('all');
  protected readonly newArea = signal('');
  protected readonly text = signal('');
  protected readonly prepOpen = signal<Set<string>>(new Set());

  private readonly areaIndex = computed(() => new Map(this.store.areaSteps().map((a, i) => [a.key, i])));
  private readonly frontierIdx = computed(() => this.areaIndex().get(this.store.frontier() ?? '') ?? -1);

  protected readonly visible = computed(() => {
    const f = this.filter();
    const q = this.text().trim().toLowerCase();
    return this.store.steps().filter(s => {
      if (q) return s.kind === 'area' && (s.name.toLowerCase().includes(q) || this.label(s.name).toLowerCase().includes(q));
      if (f === 'all') return true;
      const done = s.kind === 'area' ? this.isDone(s.key) : this.store.isDefeated(s.boss.name);
      return f === 'done' ? done : !done;
    });
  });

  constructor() {
    afterNextRender(() => {
      this.teams.load();
      const idx = this.store.areaSteps().findIndex(a => a.key === this.store.frontier());
      if (idx > 6) setTimeout(() => this.jump(false), 250);
    });
  }

  protected label(name: string): string { return this.dex.areaLabel(this.store.run()?.game ?? '', name); }

  protected canSkipAbove(key: string): boolean {
    const f = this.frontierIdx();
    return f >= 0 && (this.areaIndex().get(key) ?? -1) > f;
  }

  protected ready(afterRoute: string): boolean {
    const idx = this.store.areaSteps().findIndex(a => a.name === afterRoute);
    const f = this.frontierIdx();
    return idx >= 0 && (f === -1 || f > idx);
  }

  protected toggleTeam(name: string, ace: string): void {
    this.teams.load();
    this.dex.ensure([ace]);
    this.prepOpen.update(set => { const n = new Set(set); if (!n.delete(name)) n.add(name); return n; });
  }

  protected isBonus(name: string): boolean { return !!this.store.run()?.customAreas.includes(name); }

  protected isDone(key: string): boolean {
    return this.store.players().every(p => !!this.store.encounter(key, p));
  }

  protected jump(smooth = true): void {
    const key = this.store.frontier() ?? this.store.areaSteps().at(-1)?.key;
    this.doc.getElementById('nz-area-' + key)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
  }

  protected color(type?: string): string { return TYPE_COLORS[type ?? 'normal'] ?? TYPE_COLORS['normal']; }
  protected role(r: string): string { return ROLE[r] ?? r; }

  protected linkGlyph(key: string): string {
    return { linked: '⛓', void: '⊘', pending: '…', none: '·', solo: '' }[this.store.linkState(key)];
  }

  protected linkTitle(key: string): string {
    return {
      linked: 'Soul linked', void: 'Void: one player missed, the other catch is unusable',
      pending: 'Waiting for the other player', none: 'No link', solo: '',
    }[this.store.linkState(key)];
  }

  protected addArea(): void {
    this.store.addArea(this.newArea());
    this.newArea.set('');
  }
}
