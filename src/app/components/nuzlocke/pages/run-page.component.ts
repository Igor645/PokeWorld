import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RULE_LABELS, Rules } from '../models';
import { NuzlockeStore } from '../services/nuzlocke.store';
import { PokedexService } from '../services/pokedex.service';
import { DisplayOptionsComponent } from '../parts/display-options.component';
import { JournalViewComponent } from '../parts/journal-view.component';
import { SharePanelComponent } from '../parts/share-panel.component';
import { AreaBoardComponent } from '../parts/area-board.component';
import { BoxViewComponent } from '../parts/box-view.component';
import { GraveyardViewComponent } from '../parts/graveyard-view.component';
import { InsightsViewComponent } from '../parts/insights-view.component';
import { PartyPanelComponent } from '../parts/party-panel.component';
import { RulesViewComponent } from '../parts/rules-view.component';

type Tab = 'log' | 'box' | 'grave' | 'journal' | 'insights' | 'rules';
const TABS: Tab[] = ['log', 'box', 'grave', 'journal', 'insights', 'rules'];

@Component({
  selector: 'nz-run-page',
  imports: [
    RouterLink, AreaBoardComponent, BoxViewComponent, GraveyardViewComponent,
    InsightsViewComponent, PartyPanelComponent, RulesViewComponent, DisplayOptionsComponent, JournalViewComponent, SharePanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.run(); as r) {
      <div class="nz-page">
        <header class="nz-head">
          <a class="nz-back" routerLink="/nuzlocke">← All runs</a>
          <div class="nz-head-main">
            <h1 class="nz-title">{{ r.name }}</h1>
            <p class="nz-head-sub">
              {{ gameName() }}
              <span class="nz-tag" [class.nz-tag-soul]="store.isSoullink()">{{ store.isSoullink() ? 'Soullink' : 'Nuzlocke' }}</span>
              @if (r.isRandomizer) { <span class="nz-tag nz-tag-warn">Randomizer</span> }
              @for (c of ruleChips(); track c) { <button type="button" class="nz-rule-chip" (click)="setTab('rules')">{{ c }}</button> }
            </p>
          </div>
          <div class="nz-head-actions">
            <div class="nz-head-buttons">
              <nz-share />
              <nz-display-options />
              <button type="button" class="nz-btn nz-btn-ghost nz-btn-sm" (click)="copySummary()" title="Copy a shareable text summary">Copy summary</button>
              <button type="button" class="nz-btn nz-btn-ghost nz-btn-sm" [disabled]="!store.canUndo()" (click)="store.undo()" title="Undo (Ctrl+Z)">↶ Undo</button>
              <button type="button" class="nz-btn nz-btn-ghost nz-btn-sm" [disabled]="!store.canRedo()" (click)="store.redo()" title="Redo (Ctrl+Y)">↷ Redo</button>
            </div>
          </div>
        </header>

        @let s = store.stats();
        <section class="nz-stats" aria-label="Run summary">
          <div class="nz-stat nz-stat-progress">
            <span class="nz-eyebrow">Progress</span>
            <div class="nz-progress"><span [style.width.%]="progressPct()"></span></div>
            <span class="nz-stat-sub">{{ store.progress().done }} of {{ store.progress().total }} areas</span>
          </div>
          <div class="nz-stat"><span class="nz-eyebrow">Alive</span><strong class="nz-good">{{ s.alive }}</strong></div>
          <div class="nz-stat"><span class="nz-eyebrow">Fallen</span><strong class="nz-bad">{{ s.dead }}</strong></div>
          <div class="nz-stat"><span class="nz-eyebrow">Bosses</span><strong>{{ s.bossesDone }}<small>/{{ s.bossesTotal }}</small></strong></div>
          <div class="nz-stat nz-stat-cap">
            <span class="nz-eyebrow">Level cap</span>
            <strong>{{ store.currentCap() ?? '—' }}</strong>
            @if (store.nextBoss(); as b) { <span class="nz-stat-sub">before {{ b.name }}</span> }
          </div>
        </section>

        <div class="nz-layout">
          <section class="nz-main">
            <nav class="nz-tabs" role="tablist" aria-label="Run sections">
              @for (t of tabs(); track t.id) {
                <button type="button" role="tab" class="nz-tab" [class.nz-tab-on]="tab() === t.id"
                        [attr.aria-selected]="tab() === t.id" (click)="setTab(t.id)">
                  {{ t.label }}@if (t.count) { <span class="nz-count" [class.nz-count-bad]="t.id === 'grave'">{{ t.count }}</span> }
                </button>
              }
            </nav>
            <div class="nz-pane">
              @switch (tab()) {
                @case ('log') { <nz-area-board /> }
                @case ('box') { <nz-box-view /> }
                @case ('grave') { <nz-graveyard-view /> }
                @case ('journal') { <nz-journal-view /> }
                @case ('insights') { <nz-insights-view /> }
                @case ('rules') { <nz-rules-view /> }
              }
            </div>
          </section>
          <aside class="nz-side"><nz-party-panel /></aside>
        </div>
      </div>
    }
  `,
})
export class RunPageComponent {
  protected readonly store = inject(NuzlockeStore);
  private readonly router = inject(Router);

  protected readonly tab = signal<Tab>('log');

  private readonly dex = inject(PokedexService);
  private readonly doc = inject(DOCUMENT);

  protected readonly gameName = computed(() => {
    const r = this.store.run();
    return r ? this.dex.gameLabel(r.game) : '';
  });

  protected readonly progressPct = computed(() => {
    const { done, total } = this.store.progress();
    return total ? (done / total) * 100 : 0;
  });

  protected readonly ruleChips = computed(() => {
    const r = this.store.run();
    if (!r) return [];
    return (Object.keys(RULE_LABELS) as (keyof Rules)[])
      .filter(k => r.rules[k] && (!RULE_LABELS[k].soulOnly || r.mode === 'soullink'))
      .map(k => RULE_LABELS[k].label);
  });

  protected readonly tabs = computed<{ id: Tab; label: string; count: number }[]>(() => {
    const s = this.store.stats();
    return [
      { id: 'log', label: 'Encounters', count: 0 },
      { id: 'box', label: 'Box', count: this.store.box().p1.length + this.store.box().p2.length },
      { id: 'grave', label: 'Graveyard', count: s.dead },
      { id: 'journal', label: 'Journal', count: 0 },
      { id: 'insights', label: 'Insights', count: 0 },
      { id: 'rules', label: 'Rules', count: 0 },
    ];
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    inject(ActivatedRoute).paramMap.pipe(takeUntilDestroyed()).subscribe(m => {
      if (!this.store.open(m.get('id'))) queueMicrotask(() => void this.router.navigate(['/nuzlocke']));
    });
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(q => {
      const t = q.get('tab') as Tab | null;
      this.tab.set(t && TABS.includes(t) ? t : 'log');
    });
    destroyRef.onDestroy(() => this.store.open(null));
  }

  protected setTab(t: Tab): void {
    this.tab.set(t);
    void this.router.navigate([], { queryParams: { tab: t === 'log' ? null : t }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected async copySummary(): Promise<void> {
    const r = this.store.run();
    if (!r) return;
    const s = this.store.stats();
    const lines = [
      `${r.name} · ${this.gameName()} · ${r.mode === 'soullink' ? 'Soullink' : 'Nuzlocke'}`,
      `${this.store.progress().done}/${this.store.progress().total} areas · ${s.bossesDone}/${s.bossesTotal} bosses · ${s.alive} alive · ${s.dead} fallen`,
    ];
    for (const p of this.store.players()) {
      const party = this.store.party()[p].map(m => `${m.enc.nickname || this.dex.displayName(m.enc.species)}${m.enc.level ? ' Lv' + m.enc.level : ''}`);
      lines.push(`${this.store.isSoullink() ? this.store.playerName(p) + ' ' : ''}Party: ${party.join(', ') || 'empty'}`);
    }
    const fallen = this.store.players().flatMap(p => this.store.grave()[p]).map(m =>
      `${m.enc.nickname || this.dex.displayName(m.enc.species)} (${m.area}${m.enc.cause ? ', ' + m.enc.cause : ''})`);
    if (fallen.length) lines.push(`In memoriam: ${fallen.join('; ')}`);
    try { await navigator.clipboard.writeText(lines.join('\n')); this.store.flash('Summary copied to clipboard'); }
    catch { this.store.flash('Could not access the clipboard'); }
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      const input = this.doc.querySelector<HTMLInputElement>('.nz-step-current [data-nz-picker]') ?? this.doc.querySelector<HTMLInputElement>('[data-nz-picker]');
      if (input) { e.preventDefault(); input.scrollIntoView({ block: 'center', behavior: 'smooth' }); input.focus({ preventScroll: true }); }
      return;
    }
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); this.store.undo(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); this.store.redo(); }
  }
}
