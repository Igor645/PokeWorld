import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { PlayerId, matchups } from '../models';
import { Milestone } from '../nuzlocke-data';
import { BossTeamService } from '../services/boss-team.service';
import { NuzlockeStore } from '../services/nuzlocke.store';
import { PokedexService } from '../services/pokedex.service';

const best = (att: string[], def: string[]): number => (att.length && def.length ? Math.max(...att.map(t => matchups(def)[t])) : 1);

/** The whole roster of a gym leader / Elite Four member / champion, with an answer from your party for every Pokémon. */
@Component({
  selector: 'nz-boss-team',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!loaded()) {
      <div class="nz-bt"><p class="nz-section-hint"><span class="nz-spinner"></span> Loading rosters…</p></div>
    } @else if (fights().length === 0) {
      <div class="nz-bt"><p class="nz-section-hint">No roster data for this fight.</p></div>
    } @else {
      <div class="nz-bt">
        @if (fights().length > 1) {
          <div class="nz-chips" role="tablist" aria-label="Fights">
            @for (f of fights(); track $index; let i = $index) {
              <button type="button" role="tab" class="nz-chip" [class.nz-chip-on]="index() === i" (click)="index.set(i)">
                {{ f.who }}@if (f.variant) { <small>· {{ f.variant }}</small> }
              </button>
            }
          </div>
        }
        @if (fight(); as f) {
          @if (f.either) { <p class="nz-section-hint">You face one of these, depending on your game version.</p> }
          @else if (f.variant) { <p class="nz-section-hint">This team depends on the starter you chose.</p> }

          <div class="nz-bt-head">
            <span><b>{{ f.who }}</b> · {{ f.team.length }} Pokémon · highest Lv {{ maxLevel() }}</span>
            <button type="button" class="nz-link-btn" [disabled]="store.bossCap(boss()) === maxLevel()"
                    (click)="store.setBossCap(boss().name, maxLevel())">Use Lv {{ maxLevel() }} as the level cap</button>
          </div>

          <div class="nz-bt-mons">
            @for (m of mons(); track $index) {
              <article class="nz-bt-mon">
                <div class="nz-bt-top">
                  <img class="nz-bt-sprite" [src]="dex.sprite(m.slug)" [alt]="m.name" (error)="$any($event.target).style.visibility='hidden'">
                  <div class="nz-bt-id">
                    <b class="nz-bt-name">{{ m.name }}</b>
                    <span class="nz-bt-lv" [class.nz-lv-warn]="m.level > cap()">Lv {{ m.level }}</span>
                    <span class="nz-bt-types">@for (t of m.types; track t) { <span class="nz-type" [class]="'nz-type nz-t-' + t">{{ dex.typeName(t) }}</span> }</span>
                  </div>
                </div>
                @if (m.moves.length) { <ul class="nz-bt-moves">@for (mv of m.moves; track mv) { <li>{{ mv }}</li> }</ul> }
                <div class="nz-bt-answer" [title]="m.answer ? m.answer.name + ' hits it ×' + m.answer.deals + ' and takes ×' + m.answer.takes : 'Nobody in your party'">
                  @if (m.answer; as a) {
                    <img class="nz-bt-asprite" [src]="dex.sprite(a.slug, a.shiny)" alt="">
                    <span>{{ a.name }}</span>
                    <span class="nz-mult" [class.nz-mult-good]="a.deals >= 2" [class.nz-mult-bad]="a.deals < 1">×{{ a.deals }}</span>
                    <span class="nz-mult" [class.nz-mult-bad]="a.takes >= 2" [class.nz-mult-good]="a.takes < 1">takes ×{{ a.takes }}</span>
                  } @else { <span class="nz-bt-none">No answer in your party</span> }
                </div>
              </article>
            }
          </div>

          @if (boxPicks().length) {
            <div class="nz-bt-picks">
              <span class="nz-eyebrow">Best from your box</span>
              @for (b of boxPicks(); track b.id) {
                <span class="nz-bt-pick" [title]="b.name + ' hits ' + b.hits + ' of ' + mons().length + ' super effectively'">
                  <img class="nz-bt-asprite" [src]="dex.sprite(b.slug, b.shiny)" alt=""> {{ b.name }} <small>Lv {{ b.level || '?' }} · hits {{ b.hits }}/{{ mons().length }}</small>
                </span>
              }
            </div>
          }

          <div class="nz-bt-sum">
            <span>Party over the cap ({{ cap() }}): <b [class.nz-bad]="over() > 0">{{ over() }}</b></span>
            <span>Covered: <b [class.nz-good]="uncovered() === 0" [class.nz-bad]="uncovered() > 0">{{ mons().length - uncovered() }}/{{ mons().length }}</b> Pokémon have a super-effective answer</span>
          </div>
        }
      </div>
    }
  `,
})
export class BossTeamComponent {
  protected readonly store = inject(NuzlockeStore);
  protected readonly dex = inject(PokedexService);
  private readonly teams = inject(BossTeamService);

  readonly boss = input.required<Milestone>();
  protected readonly index = signal(0);

  protected readonly loaded = computed(() => this.teams.fights(this.store.run()?.game ?? '', this.boss().name) !== null);
  protected readonly fights = computed(() => this.teams.fights(this.store.run()?.game ?? '', this.boss().name) ?? []);
  protected readonly fight = computed(() => this.fights()[Math.min(this.index(), this.fights().length - 1)]);
  protected readonly cap = computed(() => this.store.bossCap(this.boss()));
  protected readonly maxLevel = computed(() => Math.max(0, ...(this.fight()?.team.map(t => t[1]) ?? [])));

  private readonly party = computed(() => this.store.players().flatMap(p =>
    this.store.party()[p].map(m => ({
      slug: m.enc.species, shiny: !!m.enc.shiny, level: m.enc.level, owner: p as PlayerId,
      name: (m.enc.nickname || this.dex.displayName(m.enc.species)) + (this.store.isSoullink() ? ` (${this.store.playerName(p)})` : ''),
      types: this.dex.species(m.enc.species)?.types ?? [],
    }))));

  protected readonly mons = computed(() => (this.fight()?.team ?? []).map(([slug, level, moves]) => {
    const types = this.dex.species(slug)?.types ?? [];
    const answer = this.party()
      .filter(p => p.types.length && types.length)
      .map(p => ({ ...p, deals: best(p.types, types), takes: best(types, p.types) }))
      .sort((a, b) => b.deals - a.deals || a.takes - b.takes)[0];
    return { slug, level, moves, types, name: this.dex.displayName(slug), answer: answer ?? null };
  }));

  /** Boxed Pokémon that would handle this fight best, so you know who to bring in. */
  protected readonly boxPicks = computed(() => {
    const boss = this.mons();
    if (!boss.length) return [];
    return this.store.players().flatMap(p => this.store.box()[p].map(m => {
      const types = this.dex.species(m.enc.species)?.types ?? [];
      const hits = types.length ? boss.filter(b => b.types.length && best(types, b.types) >= 2).length : 0;
      return { id: m.key + p, slug: m.enc.species, shiny: !!m.enc.shiny, level: m.enc.level, hits, name: m.enc.nickname || this.dex.displayName(m.enc.species) };
    })).filter(x => x.hits > 0).sort((a, b) => b.hits - a.hits).slice(0, 4);
  });

  protected readonly over = computed(() => this.party().filter(p => p.level > this.cap()).length);
  protected readonly uncovered = computed(() => this.mons().filter(m => !m.answer || m.answer.deals < 2).length);

  constructor() {
    effect(() => {
      const slugs = this.fights().flatMap(f => f.team.map(t => t[0]));
      untracked(() => this.dex.ensure(slugs));
    });
  }
}
