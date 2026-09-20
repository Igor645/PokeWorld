import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NuzlockeStore } from '../services/nuzlocke.store';
import { PokedexService } from '../services/pokedex.service';

@Component({
  selector: 'nz-graveyard-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let fallen = store.stats().dead;
    @if (fallen === 0) {
      <div class="nz-empty">
        <p class="nz-empty-title">Nobody has fallen. Yet.</p>
        <p class="nz-empty-text">Mark a Pokémon dead from the Encounters tab and it will be remembered here.</p>
      </div>
    }

    @for (p of store.players(); track p) {
      @if (store.grave()[p].length) {
        <section class="nz-section">
          <h3 class="nz-section-title">
            {{ store.isSoullink() ? store.playerName(p) + ' · ' : '' }}Fallen<span class="nz-count">{{ store.grave()[p].length }}</span>
          </h3>
          <div class="nz-grid nz-grid-wide">
            @for (m of store.grave()[p]; track m.key) {
              <article class="nz-tomb">
                <img class="nz-tomb-sprite" [src]="dex.sprite(m.enc.species, m.enc.shiny)" [alt]="dex.displayName(m.enc.species)"
                     (error)="$any($event.target).style.visibility='hidden'">
                <div class="nz-tomb-body">
                  <strong class="nz-tomb-name">{{ m.enc.nickname || dex.displayName(m.enc.species) }}</strong>
                  <span class="nz-tomb-sub">
                    {{ m.enc.nickname ? dex.displayName(m.enc.species) + ' · ' : '' }}{{ m.enc.level ? 'Lv ' + m.enc.level : 'Level unknown' }}
                  </span>
                  <dl class="nz-tomb-facts">
                    <div><dt>Caught</dt><dd>{{ m.area }}</dd></div>
                    <div><dt>Fell at</dt><dd>{{ m.enc.diedAt || '—' }}</dd></div>
                    <div><dt>Cause</dt><dd class="nz-tomb-cause">{{ m.enc.cause || 'Unknown' }}</dd></div>
                  </dl>
                </div>
                <button type="button" class="nz-link-btn" (click)="store.revive(m.key, p)">Revive</button>
              </article>
            }
          </div>
        </section>
      }
    }
  `,
})
export class GraveyardViewComponent {
  protected readonly store = inject(NuzlockeStore);
  protected readonly dex = inject(PokedexService);
}
