import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ALL_TYPES, PlayerId, matchups } from '../models';
import { NuzlockeStore } from '../services/nuzlocke.store';
import { PokedexService } from '../services/pokedex.service';

@Component({
  selector: 'nz-insights-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = store.stats();
    <div class="nz-tiles">
      <div class="nz-tile"><span class="nz-eyebrow">Areas logged</span><strong>{{ store.progress().done }}<small>/{{ store.progress().total }}</small></strong></div>
      <div class="nz-tile"><span class="nz-eyebrow">Alive</span><strong class="nz-good">{{ s.alive }}</strong></div>
      <div class="nz-tile"><span class="nz-eyebrow">Fallen</span><strong class="nz-bad">{{ s.dead }}</strong></div>
      <div class="nz-tile"><span class="nz-eyebrow">Survival</span><strong>{{ survival() }}<small>%</small></strong></div>
      <div class="nz-tile"><span class="nz-eyebrow">Bosses</span><strong>{{ s.bossesDone }}<small>/{{ s.bossesTotal }}</small></strong></div>
      <div class="nz-tile"><span class="nz-eyebrow">No catch</span><strong>{{ s.missed }}</strong></div>
      <div class="nz-tile"><span class="nz-eyebrow">Avg party Lv</span><strong>{{ avgLevel() }}</strong></div>
    </div>

    <section class="nz-section">
      <h3 class="nz-section-title">What is killing you</h3>
      @if (causes().length === 0) {
        <p class="nz-section-hint">No deaths recorded.</p>
      } @else {
        <ul class="nz-bars">
          @for (c of causes(); track c.cause) {
            <li>
              <span class="nz-bar-label">{{ c.cause }}</span>
              <span class="nz-bar-track"><span class="nz-bar-fill" [style.width.%]="c.count / causes()[0].count * 100"></span></span>
              <span class="nz-bar-value">{{ c.count }}</span>
            </li>
          }
        </ul>
      }
    </section>

    @for (p of store.players(); track p) {
      <section class="nz-section">
        <h3 class="nz-section-title">{{ store.isSoullink() ? store.playerName(p) + ' · ' : '' }}Party matchups</h3>
        @if (store.party()[p].length === 0) {
          <p class="nz-section-hint">Add Pokémon to the party to see how they hold up against each type.</p>
        } @else {
          <div class="nz-matrix">
            @for (t of matrix()[p]; track t.type) {
              <div class="nz-mx" [class.nz-mx-bad]="t.weak >= 2 && t.weak > t.resist" [class.nz-mx-good]="t.resist >= 2 && t.resist > t.weak">
                <span class="nz-type" [class]="'nz-type nz-t-' + t.type">{{ dex.typeName(t.type) }}</span>
                <span class="nz-mx-nums"><b class="nz-bad">▲{{ t.weak }}</b><b class="nz-good">▼{{ t.resist }}</b></span>
              </div>
            }
          </div>
          <p class="nz-section-hint">▲ Pokémon weak to that type · ▼ Pokémon that resist or are immune to it.</p>

          <h3 class="nz-section-title">{{ store.isSoullink() ? store.playerName(p) + ' · ' : '' }}Offensive coverage</h3>
          <div class="nz-matrix">
            @for (t of coverage()[p]; track t.type) {
              <div class="nz-mx" [class.nz-mx-bad]="t.hits === 0" [class.nz-mx-good]="t.hits >= 2">
                <span class="nz-type" [class]="'nz-type nz-t-' + t.type">{{ dex.typeName(t.type) }}</span>
                <span class="nz-mx-nums"><b [class.nz-bad]="t.hits === 0" [class.nz-good]="t.hits > 0">{{ t.hits === 0 ? 'gap' : t.hits + ' hit' + (t.hits === 1 ? 's' : '') }}</b></span>
              </div>
            }
          </div>
          <p class="nz-section-hint">How many party members have a type that is super effective against it. "gap" means nobody does.</p>
        }
      </section>
    }
  `,
})
export class InsightsViewComponent {
  protected readonly store = inject(NuzlockeStore);
  protected readonly dex = inject(PokedexService);

  protected readonly survival = computed(() => {
    const { alive, dead } = this.store.stats();
    return alive + dead ? Math.round(alive / (alive + dead) * 100) : 100;
  });

  protected readonly avgLevel = computed(() => {
    const lv = this.store.players().flatMap(p => this.store.party()[p]).map(m => m.enc.level).filter(l => l > 0);
    return lv.length ? Math.round(lv.reduce((a, b) => a + b, 0) / lv.length) : '—';
  });

  protected readonly causes = computed(() => {
    const counts = new Map<string, number>();
    for (const p of this.store.players()) {
      for (const m of this.store.grave()[p]) {
        const c = m.enc.cause?.startsWith('Soul link') ? 'Soul link' : (m.enc.cause || 'Unknown');
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
    return [...counts].map(([cause, count]) => ({ cause, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  });

  protected readonly coverage = computed(() => {
    const out: Record<PlayerId, { type: string; hits: number }[]> = { p1: [], p2: [] };
    for (const p of this.store.players()) {
      const members = this.store.party()[p].map(m => this.dex.species(m.enc.species)?.types ?? []).filter(t => t.length);
      out[p] = ALL_TYPES.map(type => {
        const eff = matchups([type]);
        return { type: type as string, hits: members.filter(types => types.some(t => eff[t] >= 2)).length };
      });
    }
    return out;
  });

  protected readonly matrix = computed(() => {
    const out: Record<PlayerId, { type: string; weak: number; resist: number }[]> = { p1: [], p2: [] };
    for (const p of this.store.players()) {
      const rows = ALL_TYPES.map(type => ({ type: type as string, weak: 0, resist: 0 }));
      for (const m of this.store.party()[p]) {
        const types = this.dex.species(m.enc.species)?.types;
        if (!types?.length) continue;
        const mx = matchups(types);
        for (const r of rows) { if (mx[r.type] >= 2) r.weak++; else if (mx[r.type] < 1) r.resist++; }
      }
      out[p] = rows;
    }
    return out;
  });
}
