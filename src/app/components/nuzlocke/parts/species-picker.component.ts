import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { AreaMon } from '../services/encounters.service';
import { NuzlockeStore } from '../services/nuzlocke.store';
import { PokedexService } from '../services/pokedex.service';

interface Option { slug: string; meta: string; level: number; version?: string; group: 'route' | 'all'; }

@Component({
  selector: 'nz-species-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nz-picker" [class.nz-picker-open]="open()">
      <input class="nz-picker-input" type="text" autocomplete="off" spellcheck="false" data-nz-picker
             [placeholder]="placeholder()" [value]="query()"
             (focus)="open.set(true)" (blur)="close()"
             (input)="onInput($any($event.target).value)" (keydown)="onKey($event)">
      <span class="nz-picker-caret" aria-hidden="true">▾</span>

      @if (open()) {
        <div class="nz-picker-menu" (mousedown)="$event.preventDefault()">
          @if (loading()) {
            <div class="nz-picker-note"><span class="nz-spinner"></span> Loading route encounters…</div>
          }
          @for (o of options(); track o.slug + o.group; let i = $index) {
            @if (i === 0 || options()[i - 1].group !== o.group) {
              <div class="nz-picker-group">{{ o.group === 'route' ? 'Found on this route' : 'All Pokémon' }}</div>
            }
            <button type="button" class="nz-picker-opt" [class.nz-picker-active]="active() === i"
                    (mouseenter)="active.set(i)" (click)="choose(o)">
              <img class="nz-picker-sprite" [src]="dex.sprite(o.slug)" alt="" (error)="$any($event.target).style.visibility='hidden'">
              <span class="nz-picker-name">{{ dex.displayName(o.slug) }}</span>
              <span class="nz-picker-types">@for (t of dex.species(o.slug)?.types ?? []; track t) { <span class="nz-type" [class]="'nz-type nz-t-' + t">{{ dex.typeName(t) }}</span> }</span>
              <span class="nz-picker-meta">{{ o.meta }}</span>
              @if (o.version) { <span class="nz-tag nz-tag-soul">{{ o.version }} only</span> }
              @if (isOwned(o.slug)) { <span class="nz-tag nz-tag-dupe" [title]="'You already have the ' + dex.lineName(o.slug) + ' line'">Owned line</span> }
            </button>
          }
          @if (options().length === 0 && !loading()) {
            <div class="nz-picker-note">
              {{ query().trim() ? 'No Pokémon match "' + query().trim() + '".' : 'No encounter data for this area yet. Type a name to search every Pokémon.' }}
            </div>
          }
          @if (supplemented() && route().length > 0) {
            <div class="nz-picker-credit">Encounter data from Bulbapedia (CC BY-NC-SA)</div>
          }
        </div>
      }
    </div>
  `,
})
export class SpeciesPickerComponent {
  protected readonly dex = inject(PokedexService);
  private readonly store = inject(NuzlockeStore);

  readonly mons = input<AreaMon[]>([]);
  readonly loading = input(false);
  readonly supplemented = input(false);
  readonly owned = input<Set<string>>(new Set());
  readonly placeholder = input('Log encounter…');
  readonly pick = output<{ slug: string; level: number }>();

  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(0);

  private readonly matcher = computed(() => {
    const q = this.query().trim();
    return q ? new Set(this.dex.search(q, { limit: 2000 })) : null;
  });

  protected readonly route = computed<Option[]>(() => {
    const m = this.matcher();
    return this.mons().filter(x => !m || m.has(x.slug)).map(x => {
      const lv = x.max ? ` · Lv ${x.min === x.max ? x.min : `${x.min}–${x.max}`}` : '';
      return { slug: x.slug, level: x.min, version: x.version, group: 'route' as const, meta: `${x.methods.slice(0, 2).join(' · ')}${lv}` };
    });
  });

  protected readonly options = computed<Option[]>(() => {
    const q = this.query().trim();
    const onRoute = new Set(this.mons().map(m => m.slug));
    const rest = q ? this.dex.search(q, { exclude: onRoute, limit: 24 }).map(slug => ({ slug, meta: '', level: 0, group: 'all' as const })) : [];
    return [...this.route(), ...rest];
  });

  constructor() {
    // Types make forms distinguishable (Alolan Rattata is Dark/Normal). Only the visible options are fetched.
    effect(() => {
      const slugs = this.open() ? this.options().slice(0, 40).map(o => o.slug) : [];
      untracked(() => this.dex.ensure(slugs));
    });
  }

  protected isOwned(slug: string): boolean {
    return this.owned().has(this.store.lineKey(slug));
  }

  protected onInput(value: string): void {
    this.query.set(value);
    this.active.set(0);
    this.open.set(true);
  }

  protected close(): void { this.open.set(false); this.query.set(''); }

  protected onKey(e: KeyboardEvent): void {
    const n = this.options().length;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.open.set(true); this.active.set(n ? (this.active() + 1) % n : 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.active.set(n ? (this.active() - 1 + n) % n : 0); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const o = this.options()[this.active()];
      if (o) this.choose(o);
    } else if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
  }

  protected choose(o: Option): void {
    this.pick.emit({ slug: o.slug, level: o.level });
    this.query.set('');
    this.open.set(false);
  }
}
