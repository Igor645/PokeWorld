import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ALL_TYPES, PlayerId, TYPE_COLORS, matchups } from '../models';
import { NuzlockeStore, PARTY_SIZE } from '../services/nuzlocke.store';
import { PokedexService } from '../services/pokedex.service';
import { MonControlsComponent } from './mon-controls.component';

@Component({
  selector: 'nz-party-panel',
  imports: [MonControlsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.nextBoss(); as b) {
      <section class="nz-card nz-next" [style.--boss]="color(b.type)">
        <img class="nz-next-ace" [src]="dex.sprite(b.acePokemon)" alt="" (error)="$any($event.target).style.display='none'">
        <div class="nz-next-body">
          <span class="nz-eyebrow">Next up</span>
          <strong class="nz-next-name">{{ b.name }}</strong>
          <span class="nz-next-sub">{{ b.badge ?? 'Ace ' + dex.displayName(b.acePokemon) }}</span>
        </div>
        <div class="nz-next-cap">
          <span class="nz-eyebrow">Cap</span>
          <strong>{{ store.bossCap(b) }}</strong>
        </div>
      </section>
    }

    <section class="nz-card nz-party">
      <div class="nz-card-headrow">
        <h2 class="nz-card-title">Party</h2>
        <button type="button" class="nz-link-btn" title="Battle won: +1 level for everyone in the party" (click)="store.bumpParty(1)">+1 level all</button>
      </div>
      @for (p of store.players(); track p) {
        <div class="nz-party-group">
          @if (store.isSoullink()) {
            <h3 class="nz-party-player">{{ store.playerName(p) }}<span>{{ store.party()[p].length }}/{{ size }}</span></h3>
          }
          <ul class="nz-slots">
            @if (store.party()[p].length === 0) { <li class="nz-slotcard-hint">Nobody in the party yet.</li> }
            @for (i of slotIndexes; track i) {
              @let m = store.party()[p][i];
              @if (m) {
                @let info = dex.species(m.enc.species);
                <li class="nz-slotcard" [style.--t]="color(info?.types?.[0])">
                  <img class="nz-slotcard-sprite" [src]="dex.sprite(m.enc.species, m.enc.shiny)" [alt]="dex.displayName(m.enc.species)"
                       (error)="$any($event.target).style.visibility='hidden'">
                  <div class="nz-slotcard-body">
                    <span class="nz-slotcard-name">{{ m.enc.shiny ? '✨ ' : '' }}{{ m.enc.nickname || dex.displayName(m.enc.species) }}</span>
                    <span class="nz-slotcard-sub">
                      @for (t of info?.types ?? []; track t) { <i class="nz-dot" [style.background]="color(t)" [title]="dex.typeName(t)"></i> }
                      {{ m.area }}
                    </span>
                  </div>
                  <button type="button" class="nz-slotcard-btn" title="Move to box" (click)="store.toggleSlot(m.key, p)">Box</button>
                  <nz-mon-controls class="nz-slotcard-ctl" [key]="m.key" [player]="p" />
                </li>
              } @else {
                <li class="nz-slotcard nz-slotcard-empty"><span>Empty slot</span></li>
              }
            }
          </ul>
          @if (weak()[p].length) {
            <div class="nz-weak">
              <span class="nz-eyebrow">Weak to</span>
              @for (w of weak()[p]; track w.type) {
                <span class="nz-type" [class]="'nz-type nz-t-' + w.type">{{ dex.typeName(w.type) }} ×{{ w.count }}</span>
              }
            </div>
          }
        </div>
      }
    </section>
  `,
})
export class PartyPanelComponent {
  protected readonly store = inject(NuzlockeStore);
  protected readonly dex = inject(PokedexService);
  protected readonly size = PARTY_SIZE;
  protected readonly slotIndexes = Array.from({ length: PARTY_SIZE }, (_, i) => i);

  protected readonly weak = computed(() => {
    const out: Record<PlayerId, { type: string; count: number }[]> = { p1: [], p2: [] };
    for (const p of this.store.players()) {
      const counts = new Map<string, number>();
      for (const m of this.store.party()[p]) {
        const types = this.dex.species(m.enc.species)?.types;
        if (!types?.length) continue;
        const mx = matchups(types);
        for (const t of ALL_TYPES) if (mx[t] >= 2) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
      out[p] = [...counts].filter(([, n]) => n >= 2).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count).slice(0, 6);
    }
    return out;
  });

  protected color(type?: string): string { return TYPE_COLORS[type ?? ''] ?? 'var(--nz-line)'; }

  protected warn(level: number): boolean {
    const cap = this.store.currentCap();
    return !!this.store.run()?.rules.levelCaps && cap !== null && level > cap;
  }
}
