import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Encounter, TYPE_COLORS } from '../models';
import { NuzlockeStore, PARTY_SIZE, Pair, PairState } from '../services/nuzlocke.store';
import { PokedexService } from '../services/pokedex.service';

type PairFilter = 'all' | 'party' | 'box' | 'fallen' | 'attention';

const STATE_LABEL: Record<PairState, string> = {
  party: 'In party', box: 'In box', split: 'Split', fallen: 'Fallen', half: 'One fell',
  void: 'Void', waiting: 'Waiting for partner',
};
const STATE_HINT: Record<PairState, string> = {
  party: '', box: '',
  split: 'One is in the party and the other in the box. Sync them so the link stays usable.',
  fallen: '', half: 'Linked death is off, so only one of the pair fell.',
  void: 'Their partner missed this area, so this Pokémon can\'t be used.',
  waiting: 'The other player hasn\'t logged this area yet.',
};

@Component({
  selector: 'nz-box-view',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- one half of a soul-link pair -->
    <ng-template #side let-e="enc" let-who="who">
      <div class="nz-pair-side" [class.nz-pair-dead]="e && e.slot === 'grave'">
        <span class="nz-player-label">{{ who }}</span>
        @if (e) {
          <div class="nz-pair-mon">
            <img class="nz-pair-sprite" [src]="dex.sprite(e.species, e.shiny)" [alt]="dex.displayName(e.species)" (error)="$any($event.target).style.visibility='hidden'">
            <div class="nz-pair-id">
              <b>{{ e.shiny ? '✨ ' : '' }}{{ e.nickname || dex.displayName(e.species) }}</b>
              <span class="nz-pair-sub">{{ e.nickname ? dex.displayName(e.species) + ' · ' : '' }}{{ e.level ? 'Lv ' + e.level : 'Lv ?' }}{{ e.slot === 'grave' ? ' · ☠' : '' }}</span>
              <span class="nz-pair-types">@for (t of dex.species(e.species)?.types ?? []; track t) { <i class="nz-dot" [style.background]="color(t)" [title]="dex.typeName(t)"></i> }</span>
            </div>
          </div>
        } @else { <span class="nz-pair-none">No catch</span> }
      </div>
    </ng-template>

    @if (store.isSoullink()) {
      <div class="nz-toolbar">
        <div class="nz-seg" role="group" aria-label="Filter pairs">
          @for (f of filters(); track f.id) {
            <button type="button" class="nz-seg-btn" [class.nz-seg-on]="filter() === f.id" (click)="filter.set(f.id)">{{ f.label }}<span class="nz-seg-n">{{ f.count }}</span></button>
          }
        </div>
        <span class="nz-toolbar-info">{{ store.pairs().length }} linked area{{ store.pairs().length === 1 ? '' : 's' }}</span>
      </div>

      @if (visible().length === 0) {
        <div class="nz-empty">
          <p class="nz-empty-title">{{ store.pairs().length ? 'Nothing in this view' : 'No pairs yet' }}</p>
          <p class="nz-empty-text">Log a catch for both players in an area and the linked pair shows up here.</p>
        </div>
      }

      <div class="nz-pairs">
        @for (p of visible(); track p.key) {
          <article class="nz-pair" [class]="'nz-pair nz-pair-' + p.state">
            <header class="nz-pair-head">
              <span class="nz-area-name">{{ dex.areaLabel(gameKey(), p.area) }}</span>
              <span class="nz-tag" [class.nz-tag-void]="p.state === 'void' || p.state === 'split'" [class.nz-tag-failed]="p.state === 'fallen' || p.state === 'half'"
                    [class.nz-tag-soul]="p.state === 'waiting'">{{ label(p.state) }}</span>
            </header>
            <div class="nz-pair-body">
              <ng-container *ngTemplateOutlet="side; context: { enc: p.a, who: store.playerName('p1') }" />
              <div class="nz-pair-link" [title]="hint(p.state) || 'Soul linked'">{{ p.a && p.b ? '⛓' : '…' }}</div>
              <ng-container *ngTemplateOutlet="side; context: { enc: p.b, who: store.playerName('p2') }" />
            </div>

            @if (hint(p.state)) { <p class="nz-pair-hint">{{ hint(p.state) }}</p> }

            <footer class="nz-pair-actions">
              @if (p.state === 'party' || p.state === 'box' || p.state === 'split') {
                <button type="button" class="nz-btn nz-btn-ghost nz-btn-sm" (click)="toggle(p)">
                  {{ p.state === 'party' ? 'Move pair to box' : (p.state === 'split' ? 'Sync pair to party' : 'Move pair to party') }}
                </button>
                @if (p.state === 'split') { <button type="button" class="nz-btn nz-btn-ghost nz-btn-sm" (click)="store.movePair(p.key, 'box')">Sync to box</button> }
                <button type="button" class="nz-btn nz-btn-danger nz-btn-sm" (click)="dying.set(dying() === p.key ? null : p.key)">☠ Pair fell</button>
              } @else if (p.state === 'fallen' || p.state === 'half') {
                <button type="button" class="nz-btn nz-btn-ghost nz-btn-sm" (click)="store.revivePair(p.key)">Revive pair</button>
              }
            </footer>

            @if (swapFor() === p.key) {
              <div class="nz-inline-panel">
                <span class="nz-eyebrow">A party is full. Swap with a pair that is in the party:</span>
                <div class="nz-chips">
                  @for (q of partyPairs(); track q.key) {
                    <button type="button" class="nz-chip" (click)="swap(p.key, q.key)">
                      @if (q.a) { <img class="nz-chip-sprite" [src]="dex.sprite(q.a.species, q.a.shiny)" alt=""> }
                      @if (q.b) { <img class="nz-chip-sprite" [src]="dex.sprite(q.b.species, q.b.shiny)" alt=""> }
                      {{ dex.areaLabel(gameKey(), q.area) }}
                    </button>
                  }
                </div>
              </div>
            }

            @if (dying() === p.key) {
              <div class="nz-death">
                <div class="nz-death-title">What killed this pair?</div>
                <div class="nz-chips">
                  @for (c of causes(); track c) { <button type="button" class="nz-chip" [class.nz-chip-on]="cause() === c" (click)="cause.set(c)">{{ c }}</button> }
                </div>
                <div class="nz-death-row">
                  <input class="nz-input" type="text" placeholder="Or write your own…" [value]="cause()" (input)="cause.set($any($event.target).value)" (keydown.enter)="confirmDeath(p.key)">
                  <button type="button" class="nz-btn nz-btn-danger nz-btn-sm" (click)="confirmDeath(p.key)">☠ Confirm</button>
                  <button type="button" class="nz-btn nz-btn-ghost nz-btn-sm" (click)="dying.set(null)">Cancel</button>
                </div>
              </div>
            }
          </article>
        }
      </div>
    } @else {
      @let total = store.box().p1.length + store.voided().p1.length;
      @if (total === 0) {
        <div class="nz-empty">
          <p class="nz-empty-title">The box is empty</p>
          <p class="nz-empty-text">Pokémon you move out of the party, or catch while the party is full, wait here.</p>
        </div>
      }
      @if (store.box().p1.length) {
        <section class="nz-section">
          <h3 class="nz-section-title">Box<span class="nz-count">{{ store.box().p1.length }}</span></h3>
          <div class="nz-grid">
            @for (m of store.box().p1; track m.key) {
              @let info = dex.species(m.enc.species);
              <article class="nz-mcard" [style.--t]="color(info?.types?.[0])">
                <img class="nz-mcard-sprite" [src]="dex.sprite(m.enc.species, m.enc.shiny)" [alt]="dex.displayName(m.enc.species)" (error)="$any($event.target).style.visibility='hidden'">
                <div class="nz-mcard-body">
                  <strong class="nz-mcard-name">{{ m.enc.shiny ? '✨ ' : '' }}{{ m.enc.nickname || dex.displayName(m.enc.species) }}</strong>
                  @if (m.enc.nickname) { <span class="nz-mcard-sub">{{ dex.displayName(m.enc.species) }}</span> }
                  <span class="nz-mcard-meta">@for (t of info?.types ?? []; track t) { <span class="nz-type" [class]="'nz-type nz-t-' + t">{{ dex.typeName(t) }}</span> }</span>
                  <span class="nz-mcard-from">{{ dex.areaLabel(gameKey(), m.area) }}{{ m.enc.level ? ' · Lv ' + m.enc.level : '' }}</span>
                </div>
                <button type="button" class="nz-btn nz-btn-ghost nz-btn-sm" [disabled]="store.party().p1.length >= size" (click)="store.toggleSlot(m.key, 'p1')">To party</button>
              </article>
            }
          </div>
        </section>
      }
    }
  `,
})
export class BoxViewComponent {
  protected readonly store = inject(NuzlockeStore);
  protected readonly dex = inject(PokedexService);
  protected readonly size = PARTY_SIZE;

  protected readonly filter = signal<PairFilter>('box');
  protected readonly swapFor = signal<string | null>(null);
  protected readonly dying = signal<string | null>(null);
  protected readonly cause = signal('');

  protected readonly gameKey = computed(() => this.store.run()?.game ?? '');
  protected readonly partyPairs = computed(() => this.store.pairs().filter(p => p.state === 'party'));

  private inFilter(p: Pair, f: PairFilter): boolean {
    switch (f) {
      case 'all': return true;
      case 'party': return p.state === 'party';
      case 'box': return p.state === 'box';
      case 'fallen': return p.state === 'fallen' || p.state === 'half';
      default: return p.state === 'split' || p.state === 'void' || p.state === 'waiting';
    }
  }

  protected readonly filters = computed(() => ([
    ['box', 'Box'], ['party', 'Party'], ['fallen', 'Fallen'], ['attention', 'Needs attention'], ['all', 'All'],
  ] as [PairFilter, string][]).map(([id, label]) => ({ id, label, count: this.store.pairs().filter(p => this.inFilter(p, id)).length })));

  protected readonly visible = computed(() => this.store.pairs().filter(p => this.inFilter(p, this.filter())));

  protected readonly causes = computed(() => {
    const b = this.store.nextBoss();
    return [...(b ? [`${b.name}'s ${this.dex.displayName(b.acePokemon)}`] : []), 'Wild Pokémon', 'Trainer', 'Rival'];
  });

  protected label(s: PairState): string { return STATE_LABEL[s]; }
  protected hint(s: PairState): string { return STATE_HINT[s]; }
  protected color(type?: string): string { return TYPE_COLORS[type ?? ''] ?? 'var(--nz-line)'; }

  protected toggle(p: Pair): void {
    const toParty = p.state !== 'party';
    const full = this.store.party().p1.length >= PARTY_SIZE || this.store.party().p2.length >= PARTY_SIZE;
    const alreadyIn = (e: Encounter | null) => e?.slot === 'party';
    const needsRoom = toParty && ((!alreadyIn(p.a) && this.store.party().p1.length >= PARTY_SIZE) || (!alreadyIn(p.b) && this.store.party().p2.length >= PARTY_SIZE));
    if (needsRoom && full) { this.swapFor.set(p.key); return; }
    this.swapFor.set(null);
    this.store.movePair(p.key);
  }

  protected swap(inKey: string, outKey: string): void {
    this.swapFor.set(null);
    this.store.swapPairs(inKey, outKey);
  }

  protected confirmDeath(key: string): void {
    this.store.killPair(key, this.cause());
    this.dying.set(null);
    this.cause.set('');
  }
}
