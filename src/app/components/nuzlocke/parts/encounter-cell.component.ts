import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { ALL_TYPES, Outcome, PlayerId, formatName, matchups } from '../models';
import { EncounterService } from '../services/encounters.service';
import { NuzlockeStore } from '../services/nuzlocke.store';
import { PokedexService } from '../services/pokedex.service';
import { MonControlsComponent } from './mon-controls.component';
import { SpeciesPickerComponent } from './species-picker.component';

const MISS_LABEL: Record<Exclude<Outcome, 'caught'>, string> = { failed: 'No catch', dupe: 'Dupe', skipped: 'Skipped' };
const MISS_HINT: Record<Exclude<Outcome, 'caught'>, string> = {
  failed: 'It fled or fainted', dupe: 'Already owned: skipped by the dupes clause', skipped: 'Nothing logged for this area',
};
const STAT_LABELS: [keyof import('../services/pokedex.service').BaseStats, string][] =
  [['hp', 'HP'], ['atk', 'Atk'], ['def', 'Def'], ['spa', 'SpA'], ['spd', 'SpD'], ['spe', 'Spe']];

@Component({
  selector: 'nz-encounter-cell',
  imports: [SpeciesPickerComponent, MonControlsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let e = enc();
    @if (!e || changing()) {
      <div class="nz-cell nz-cell-empty">
        <nz-species-picker [mons]="mons()" [loading]="loading()" [owned]="owned()" [supplemented]="supplemented()"
                           [placeholder]="changing() ? 'Change species…' : 'Log encounter…'"
                           (pick)="log($event)" />
        @if (changing()) {
          <button type="button" class="nz-btn nz-btn-ghost nz-btn-sm" (click)="changing.set(false)">Cancel</button>
        } @else {
          @if (quick().length) {
            <div class="nz-quick">
              @for (m of quick(); track m.slug) {
                <button type="button" class="nz-quick-btn" [title]="dex.displayName(m.slug)" (click)="log({ slug: m.slug, level: m.min })">
                  <img class="nz-quick-sprite" [src]="dex.sprite(m.slug)" [alt]="dex.displayName(m.slug)"
                       (error)="$any($event.target).style.display='none'">
                </button>
              }
              @if (mons().length > quick().length) { <span class="nz-quick-more">+{{ mons().length - quick().length }}</span> }
            </div>
          }
          <div class="nz-misses">
            <button type="button" class="nz-miss" title="It fled, fainted or you ran out of balls" (click)="store.markMiss(key(), player(), 'failed')">No catch</button>
            @if (rules()?.dupesClause) {
              <button type="button" class="nz-miss" title="Owned already: skip by the dupes clause" (click)="store.markMiss(key(), player(), 'dupe')">Dupe</button>
            }
            <button type="button" class="nz-miss" title="Skip this area" (click)="store.markMiss(key(), player(), 'skipped')">Skip</button>
          </div>
        }
      </div>
    } @else if (e.outcome === 'dupe' && e.species) {
      <div class="nz-cell nz-cell-miss">
        <img class="nz-dupe-sprite" [src]="dex.sprite(e.species)" alt="">
        <span class="nz-tag nz-tag-dupe">Dupe</span>
        <span class="nz-cell-hint"><b>{{ dex.displayName(e.species) }}</b>: you already have the {{ dex.lineName(e.species) }} line</span>
        @if (rules()?.shinyClause) {
          <button type="button" class="nz-link-btn" title="Shiny clause: shinies may always be caught" (click)="catchShiny()">✨ It's shiny</button>
        }
        <button type="button" class="nz-link-btn" title="Catch it anyway" (click)="catchAnyway()">Catch anyway</button>
        <button type="button" class="nz-link-btn" (click)="store.clearEncounter(key(), player())">Change</button>
      </div>
    } @else if (e.outcome !== 'caught') {
      <div class="nz-cell nz-cell-miss">
        <span class="nz-tag" [class]="'nz-tag nz-tag-' + e.outcome">{{ missLabel(e.outcome) }}</span>
        <span class="nz-cell-hint">{{ missHint(e.outcome) }}</span>
        <button type="button" class="nz-link-btn" (click)="store.clearEncounter(key(), player())">Change</button>
      </div>
    } @else {
      <div class="nz-cell nz-mon" [class.nz-mon-dead]="e.slot === 'grave'" [class.nz-mon-void]="isVoid()" [class.nz-mon-shiny]="e.shiny">
        <img class="nz-mon-sprite" [src]="dex.sprite(e.species, e.shiny)" [alt]="name()" (error)="$any($event.target).style.visibility='hidden'">
        <div class="nz-mon-id">
          <div class="nz-mon-line">
            <span class="nz-mon-name">{{ e.shiny ? '✨ ' : '' }}{{ name() }}</span>
            @for (t of info()?.types ?? []; track t) { <span class="nz-type" [class]="'nz-type nz-t-' + t">{{ dex.typeName(t) }}</span> }
          </div>
          @if (e.slot === 'grave') {
            <div class="nz-mon-grave">
              ☠ {{ e.nickname ? '“' + e.nickname + '” · ' : '' }}{{ e.cause || 'Unknown cause' }}
            </div>
          } @else {
            <input class="nz-nick" type="text" placeholder="Nickname" [value]="e.nickname" aria-label="Nickname" #nick
                   (change)="store.patch(key(), player(), { nickname: $any($event.target).value.trim() })"
                   (keydown.enter)="$any($event.target).blur()">
          }
        </div>

        <nz-mon-controls [key]="key()" [player]="player()" />

        @if (e.slot === 'grave') {
          <button type="button" class="nz-link-btn" (click)="store.revive(key(), player())">Revive</button>
        } @else {
          @if (isVoid()) {
            <span class="nz-tag nz-tag-void" title="The linked partner missed this area">Void</span>
          } @else {
            <button type="button" class="nz-slot" [class.nz-slot-party]="e.slot === 'party'"
                    [title]="e.slot === 'party' ? 'Move to box' : 'Move to party'" (click)="store.toggleSlot(key(), player())">
              {{ e.slot === 'party' ? 'Party' : 'Box' }}
            </button>
          }
          <div class="nz-cell-tools">
            <button type="button" class="nz-icon-btn" [class.nz-icon-on]="details()" title="Details: stats, abilities, matchups" (click)="details.set(!details())">ⓘ</button>
            <button type="button" class="nz-icon-btn" [class.nz-icon-on]="e.shiny" title="Toggle shiny" (click)="store.patch(key(), player(), { shiny: !e.shiny })">✨</button>
            <button type="button" class="nz-icon-btn" title="Change species" (click)="changing.set(true)">⇄</button>
            <button type="button" class="nz-icon-btn" title="Remove this encounter" (click)="store.clearEncounter(key(), player())">✕</button>
          </div>
        }
      </div>

      @if (details() && info(); as i) {
        <div class="nz-detail">
          <div class="nz-detail-cols">
            <div class="nz-sbars">
              @for (s of statLabels; track s[0]) {
                <div class="nz-sbar">
                  <span>{{ s[1] }}</span>
                  <span class="nz-sbar-track"><span [style.width.%]="min(i.stats[s[0]] / 2, 100)" [class]="'sq-' + quality(i.stats[s[0]])"></span></span>
                  <b>{{ i.stats[s[0]] }}</b>
                </div>
              }
            </div>
            <div class="nz-detail-side">
              <div class="nz-detail-line"><span class="nz-eyebrow">Abilities</span>
                <span>{{ abilityText() }}</span>
              </div>
              @if (weakTo().length) {
                <div class="nz-detail-line"><span class="nz-eyebrow">Weak to</span>
                  <span class="nz-chips">@for (w of weakTo(); track w.type) { <span class="nz-type" [class]="'nz-type nz-t-' + w.type">{{ dex.typeName(w.type) }}{{ w.x4 ? ' ×4' : '' }}</span> }</span>
                </div>
              }
              @if (resists().length) {
                <div class="nz-detail-line"><span class="nz-eyebrow">Resists</span>
                  <span class="nz-chips">@for (t of resists(); track t) { <span class="nz-type nz-type-dim" [class]="'nz-type nz-type-dim nz-t-' + t">{{ dex.typeName(t) }}</span> }</span>
                </div>
              }
              <div class="nz-detail-edit">
                <label class="nz-cd-field"><span class="nz-cd-label">Ability</span>
                  <select class="nz-select" (change)="store.patch(key(), player(), { ability: $any($event.target).value || undefined })">
                    <option value="" [selected]="!e.ability">Not sure</option>
                    @for (a of i.abilities; track a.slug) { <option [value]="a.slug" [selected]="e.ability === a.slug">{{ dex.abilityName(a.slug) }}{{ a.hidden ? ' (hidden)' : '' }}</option> }
                  </select>
                </label>
                <label class="nz-cd-field"><span class="nz-cd-label">Held item</span>
                  <input class="nz-input nz-cd-input" type="text" placeholder="e.g. Oran Berry" [value]="e.item || ''" (change)="store.patch(key(), player(), { item: $any($event.target).value.trim() || undefined })">
                </label>
                <label class="nz-cd-field nz-cd-wide"><span class="nz-cd-label">Moves</span>
                  <input class="nz-input nz-cd-input" type="text" placeholder="Tackle, Growl, Bite…" [value]="e.moves || ''" (change)="store.patch(key(), player(), { moves: $any($event.target).value.trim() || undefined })">
                </label>
                <label class="nz-cd-field nz-cd-wide"><span class="nz-cd-label">Note</span>
                  <input class="nz-input nz-cd-input" type="text" placeholder="Gift from Mr. Pokémon, traded, HM slave…" [value]="e.note || ''" (change)="store.patch(key(), player(), { note: $any($event.target).value.trim() || undefined })">
                </label>
              </div>
              @if (evolutions().length) {
                <div class="nz-detail-line"><span class="nz-eyebrow">Evolves</span>
                  <span>{{ evolveText() }}</span>
                </div>
              }
            </div>
          </div>
        </div>
      }

    }
  `,
})
export class EncounterCellComponent {
  protected readonly store = inject(NuzlockeStore);
  protected readonly dex = inject(PokedexService);
  private readonly encSvc = inject(EncounterService);

  readonly key = input.required<string>();
  readonly area = input.required<string>();
  readonly player = input.required<PlayerId>();

  protected readonly changing = signal(false);
  protected readonly details = signal(false);
  protected readonly statLabels = STAT_LABELS;

  private readonly nickEl = viewChild<ElementRef<HTMLInputElement>>('nick');
  private focusNick = false;

  protected readonly rules = computed(() => this.store.run()?.rules);
  protected readonly enc = computed(() => this.store.encounter(this.key(), this.player()));
  protected readonly info = computed(() => { const e = this.enc(); return e?.species ? this.dex.species(e.species) : undefined; });
  protected readonly name = computed(() => { const e = this.enc(); return e?.species ? this.dex.displayName(e.species) : ''; });
  protected readonly isVoid = computed(() => this.store.isVoidAt(this.key(), this.player()));

  private readonly areaState = computed(() => {
    const r = this.store.run();
    return r && !r.isRandomizer && r.game !== 'custom' ? this.encSvc.area(r.game, this.area()) : undefined;
  });
  protected readonly mons = computed(() => this.areaState()?.mons ?? []);
  protected readonly supplemented = computed(() => this.areaState()?.supplemented ?? false);
  protected readonly loading = computed(() => this.areaState()?.status === 'loading');

  protected readonly owned = computed(() => (this.rules()?.dupesClause ? this.store.ownedChains(this.player(), this.key()) : new Set<string>()));
  protected readonly quick = computed(() =>
    this.mons().filter(m => !this.owned().has(this.store.lineKey(m.slug))).slice(0, 7));

  protected readonly evolutions = computed(() => { const e = this.enc(); return e?.outcome === 'caught' && e.species ? this.dex.evolutionsFrom(e.species) : []; });

  protected readonly abilityText = computed(() =>
    (this.info()?.abilities ?? []).map(a => this.dex.abilityName(a.slug) + (a.hidden ? ' (hidden)' : '')).join(', '));
  protected readonly evolveText = computed(() =>
    this.evolutions().map(to => this.dex.displayName(to) + (this.dex.evolveHint(to) ? ` (${this.dex.evolveHint(to)})` : '')).join(', '));

  protected readonly matchup = computed(() => matchups(this.info()?.types ?? []));
  protected readonly weakTo = computed(() => ALL_TYPES.filter(t => this.matchup()[t] >= 2).map(type => ({ type: type as string, x4: this.matchup()[type] >= 4 })));
  protected readonly resists = computed(() => ALL_TYPES.filter(t => this.matchup()[t] < 1).map(t => t as string));

  constructor() {
    effect(() => {
      const ev = this.evolutions();
      untracked(() => this.dex.ensureEvolution(ev));
    });
    effect(() => {
      const el = this.nickEl();
      if (el && this.focusNick) { this.focusNick = false; queueMicrotask(() => el.nativeElement.focus()); }
    });
  }

  protected missLabel(o: Outcome): string { return o === 'caught' ? '' : MISS_LABEL[o]; }
  protected missHint(o: Outcome): string { return o === 'caught' ? '' : MISS_HINT[o]; }
  protected min(a: number, b: number): number { return Math.min(a, b); }
  protected quality(v: number): string { return v < 50 ? 'bad' : v < 80 ? 'low' : v < 110 ? 'mid' : v < 140 ? 'good' : 'great'; }
  protected formatName = formatName;

  protected log(p: { slug: string; level: number }): void {
    this.changing.set(false);
    this.focusNick = true;
    this.store.logEncounter(this.key(), this.player(), p.slug, p.level);
  }

  protected catchAnyway(): void { const e = this.enc(); if (e) this.store.logEncounter(this.key(), this.player(), e.species, e.level, { force: true }); }
  protected catchShiny(): void { const e = this.enc(); if (e) this.store.logEncounter(this.key(), this.player(), e.species, e.level, { shiny: true }); }
}
