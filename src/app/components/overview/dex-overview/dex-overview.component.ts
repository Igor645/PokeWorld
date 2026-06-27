import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef,
  Inject, OnDestroy, OnInit, PLATFORM_ID, ViewChild
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { BehaviorSubject, Observable, Subscription, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { MatIcon } from '@angular/material/icon';

import { Generation } from '../../../models/generation.model';
import { Pokemon } from '../../../models/pokemon.model';
import { PokemonCardComponent } from '../../shared/pokemon-card/pokemon-card.component';
import { PokemonService } from '../../../services/pokemon.service';
import { PokemonSpecies } from '../../../models/pokemon-species.model';
import { PokemonTypeComponent } from '../../shared/pokemon-type/pokemon-type.component';
import { PokemonUtilsService } from '../../../utils/pokemon-utils';
import { PokeworldSearchComponent } from '../../search/pokeworld-search/pokeworld-search.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { Type } from '../../../models/type.model';
import { TypeService } from '../../../services/type.service';
import { RecentlyViewedService, RecentEntry } from '../../../services/recently-viewed.service';
import { SettingsService } from '../../../services/settings.service';

interface DisplayEntry {
  species: PokemonSpecies;
  pokemon: Pokemon;
}

interface DisplayRow {
  rowId: number;
  entries: DisplayEntry[];
}

interface SilhouetteConfig {
  species: PokemonSpecies;
  styles: { [key: string]: string };
}

interface GenTileConfig {
  id: number;
  roman: string;
  region: string;
  accentColor: string;
  legendaryId: number;
  games: string[];
  count: number;
  spriteUrl: string;
}

const FORM_FILTER_OPTIONS = [
  { value: 'mega'   as const, label: 'Mega',       test: (n: string) => n.includes('-mega') },
  { value: 'gmax'   as const, label: 'Gigantamax', test: (n: string) => n.endsWith('-gmax') },
  { value: 'alola'  as const, label: 'Alolan',     test: (n: string) => n.includes('-alola') && !n.endsWith('-totem') && !n.endsWith('-cap') },
  { value: 'galar'  as const, label: 'Galarian',   test: (n: string) => n.includes('-galar') && !n.endsWith('-zen') },
  { value: 'hisui'  as const, label: 'Hisuian',    test: (n: string) => n.includes('-hisui') },
  { value: 'paldea' as const, label: 'Paldean',    test: (n: string) => n.includes('-paldea') },
];

type FormFilterValue = typeof FORM_FILTER_OPTIONS[number]['value'];

const GAME_COLORS: Record<string, string> = {
  'Red': '#CC0000', 'Blue': '#003088', 'Yellow': '#D4A800',
  'Gold': '#B8860B', 'Silver': '#9090A0', 'Crystal': '#3BAAD4',
  'Ruby': '#B30000', 'Sapphire': '#0000CD', 'Emerald': '#006400',
  'FireRed': '#E84000', 'LeafGreen': '#2E8B22',
  'Diamond': '#6677CC', 'Pearl': '#CC77AA', 'Platinum': '#707080',
  'HeartGold': '#B8860B', 'SoulSilver': '#909099',
  'Black': '#2C2C3C', 'White': '#888899', 'Black 2': '#2C4488', 'White 2': '#4488AA',
  'X': '#025DA6', 'Y': '#E3000B', 'Omega Ruby': '#B30000', 'Alpha Sapphire': '#0000CC',
  'Sun': '#E07000', 'Moon': '#4030AA', 'Ultra Sun': '#CC4000', 'Ultra Moon': '#4420CC',
  "Let's Go Pikachu": '#D4A800', "Let's Go Eevee": '#A06432',
  'Sword': '#0077BB', 'Shield': '#CC2255', 'Legends: Arceus': '#8A6200',
  'Brilliant Diamond': '#6677CC', 'Shining Pearl': '#CC77AA',
  'Scarlet': '#CC2200', 'Violet': '#5500AA',
};

const GENERATION_INFO: Array<Omit<GenTileConfig, 'count' | 'spriteUrl'>> = [
  { id: 1, roman: 'I',    region: 'Kanto',  accentColor: '#CC3344', legendaryId: 150,
    games: ['Red', 'Blue', 'Yellow'] },
  { id: 2, roman: 'II',   region: 'Johto',  accentColor: '#B8860B', legendaryId: 249,
    games: ['Gold', 'Silver', 'Crystal'] },
  { id: 3, roman: 'III',  region: 'Hoenn',  accentColor: '#CC0044', legendaryId: 384,
    games: ['Ruby', 'Sapphire', 'Emerald', 'FireRed', 'LeafGreen'] },
  { id: 4, roman: 'IV',   region: 'Sinnoh', accentColor: '#4488CC', legendaryId: 487,
    games: ['Diamond', 'Pearl', 'Platinum', 'HeartGold', 'SoulSilver'] },
  { id: 5, roman: 'V',    region: 'Unova',  accentColor: '#555577', legendaryId: 643,
    games: ['Black', 'White', 'Black 2', 'White 2'] },
  { id: 6, roman: 'VI',   region: 'Kalos',  accentColor: '#0055AA', legendaryId: 716,
    games: ['X', 'Y', 'Omega Ruby', 'Alpha Sapphire'] },
  { id: 7, roman: 'VII',  region: 'Alola',  accentColor: '#E07800', legendaryId: 791,
    games: ['Sun', 'Moon', 'Ultra Sun', 'Ultra Moon', "Let's Go Pikachu", "Let's Go Eevee"] },
  { id: 8, roman: 'VIII', region: 'Galar',  accentColor: '#0088FF', legendaryId: 888,
    games: ['Sword', 'Shield', 'Brilliant Diamond', 'Shining Pearl', 'Legends: Arceus'] },
  { id: 9, roman: 'IX',   region: 'Paldea', accentColor: '#CC2200', legendaryId: 1007,
    games: ['Scarlet', 'Violet'] },
];

@Component({
  selector: 'app-dex-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    MatIcon,
    PokemonCardComponent,
    PokemonTypeComponent,
    ScrollingModule,
    PokeworldSearchComponent,
    LoadingSpinnerComponent,
  ],
  templateUrl: './dex-overview.component.html',
  styleUrls: ['./dex-overview.component.css'],
})
export class DexOverviewComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;
  @ViewChild('rowContainer', { static: false }) rowContainer?: ElementRef<HTMLElement>;

  cardsPerRow = 6;
  rowVisualHeight = 350;
  itemSize = 350;
  count = 0;

  availableGenerations: Generation[] = [];
  allTypes: Type[] = [];
  readonly formFilterOptions = FORM_FILTER_OPTIONS;

  genFilter: number | null = null;
  type1Filter: number | null = null;
  type2Filter: number | null = null;
  formFilter: FormFilterValue | null = null;

  // ── Showcase ───────────────────────────────────────────────────────────────
  bgSilhouettes: SilhouetteConfig[] = [];
  marqueeRow1: PokemonSpecies[] = [];
  marqueeRow2: PokemonSpecies[] = [];
  genTiles: GenTileConfig[] = [];
  recentlyViewed: RecentEntry[] = [];

  private allSpecies: PokemonSpecies[] = [];
  private _filteredEntries: DisplayEntry[] = [];
  private versionNameMap = new Map<string, string>();
  private cachedVersionData: Array<{ versionnames: Array<{ name: string; language_id: number }> }> = [];
  private langSub?: Subscription;

  private speciesRowsSubject = new BehaviorSubject<DisplayRow[]>([]);
  speciesRows$: Observable<DisplayRow[]> = this.speciesRowsSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(true);
  isLoading$ = this.isLoadingSubject.asObservable();

  private readonly CARD_ASPECT_RATIO = 5 / 7;
  private rafId = 0;
  private ro?: ResizeObserver;

  get hasActiveFilters(): boolean {
    return !!(this.genFilter || this.type1Filter || this.type2Filter || this.formFilter);
  }

  get filteredCount(): number {
    return this._filteredEntries.length;
  }

  recentSpeciesData: DisplayEntry[] = [];

  trackRecentById(_: number, entry: DisplayEntry): number {
    return entry.species.id;
  }

  private spriteStyleSub?: Subscription;

  constructor(
    private router: Router,
    private pokemonService: PokemonService,
    private typeService: TypeService,
    private recentlyViewedService: RecentlyViewedService,
    public pokemonUtils: PokemonUtilsService,
    private settingsService: SettingsService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: object
  ) { }

  ngOnInit(): void {
    this.recentlyViewed = this.recentlyViewedService.getAll();
    this.updateLayout();
    this.fetchAllPokemon();
    this.pokemonService.getVersionNames().subscribe(versions => {
      this.cachedVersionData = versions;
      this.buildVersionNameMap();
      this.cdr.detectChanges();
    });
    this.langSub = this.pokemonUtils.watchLanguageChanges().subscribe(() => {
      this.buildVersionNameMap();
      this.cdr.detectChanges();
    });
    this.typeService.getAllTypes().pipe(
      map(res => res.type.filter(t => t.id >= 1 && t.id <= 18))
    ).subscribe(types => {
      this.allTypes = types;
      this.cdr.detectChanges();
    });
    this.spriteStyleSub = this.settingsService.watchSetting<string>('spriteStyle').subscribe(() => {
      this.initGenTiles();
      this.cdr.detectChanges();
    });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (this.viewport?.elementRef?.nativeElement) {
      this.ro = new ResizeObserver(this.scheduleLayout);
      this.ro.observe(this.viewport.elementRef.nativeElement);
    }

    window.addEventListener('resize', this.scheduleLayout, { passive: true });
    window.visualViewport?.addEventListener('resize', this.scheduleLayout, { passive: true });

    this.safeRaf(this.scheduleLayout);
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
    this.spriteStyleSub?.unsubscribe();
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.rafId) this.safeCancel(this.rafId);
    this.ro?.disconnect();
    window.removeEventListener('resize', this.scheduleLayout);
    window.visualViewport?.removeEventListener('resize', this.scheduleLayout);
  }

  // ── Filter handlers ────────────────────────────────────────────────────────

  onTypeClick(typeId: number): void {
    if (this.type1Filter === typeId) {
      this.type1Filter = null;
      this.type2Filter = null;
    } else if (this.type2Filter === typeId) {
      this.type2Filter = null;
    } else if (this.type1Filter === null) {
      this.type1Filter = typeId;
    } else {
      this.type2Filter = typeId;
    }
    this.updateRows();
  }

  onFilterChange(): void {
    this.updateRows();
  }

  setGenFilter(genId: number | null): void {
    this.genFilter = genId;
    this.updateRows();
  }

  setFormFilter(value: FormFilterValue | null): void {
    this.formFilter = value;
    this.updateRows();
  }

  clearFilters(): void {
    this.genFilter = null;
    this.type1Filter = null;
    this.type2Filter = null;
    this.formFilter = null;
    this.updateRows();
  }

  getRomanForGenId(id: number): string {
    const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
    return romans[id - 1] ?? `Gen ${id}`;
  }

  getGameColor(game: string): string {
    return GAME_COLORS[game] ?? '#666';
  }

  // ── Gen tile / navigation ──────────────────────────────────────────────────

  onGenTileClick(genId: number): void {
    this.genFilter = this.genFilter === genId ? null : genId;
    this.updateRows();
  }

  navigateToPokemon(name: string): void {
    this.router.navigate(['/pokemon', name]);
  }

  private hasSprite(p: Pokemon): boolean {
    const sprites = p.pokemonsprites?.[0]?.sprites;
    return !!(sprites?.front_default || sprites?.other?.['official-artwork']?.front_default);
  }

  getPlaceholderArray(count: number): number[] {
    return count > 0 ? Array(count).fill(0) : [];
  }

  // ── Showcase helpers ───────────────────────────────────────────────────────

  getSprite(species: PokemonSpecies): string {
    const sprites = species.pokemons[0]?.pokemonsprites?.[0]?.sprites;
    const style = this.settingsService.getSetting<string>('spriteStyle');
    if (style === 'home')  return sprites?.other?.home?.front_default || sprites?.other?.['official-artwork']?.front_default || '';
    if (style === 'pixel') return sprites?.front_default || '';
    return sprites?.other?.['official-artwork']?.front_default || sprites?.other?.home?.front_default || '';
  }

  getShowcaseSprite(species: PokemonSpecies): string {
    const sprites = species.pokemons[0]?.pokemonsprites?.[0]?.sprites;
    return sprites?.other?.['official-artwork']?.front_default
      || sprites?.other?.home?.front_default
      || sprites?.front_default
      || '';
  }

  getLocalizedGameName(name: string): string {
    return this.versionNameMap.get(this.normStr(name)) ?? name;
  }

  private buildVersionNameMap(): void {
    const langId = this.pokemonUtils.getSelectedLanguageId();
    this.versionNameMap.clear();
    for (const v of this.cachedVersionData) {
      const enName = v.versionnames?.find(n => n.language_id === 9)?.name;
      const locName = v.versionnames?.find(n => n.language_id === langId)?.name;
      if (enName && locName) this.versionNameMap.set(this.normStr(enName), locName);
    }
  }

  private normStr(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private initShowcases(): void {
    const withSprites = this.allSpecies.filter(s => {
      const sp = s.pokemons[0]?.pokemonsprites?.[0]?.sprites;
      return !!(sp?.other?.['official-artwork']?.front_default || sp?.other?.home?.front_default);
    });

    const dayOffset = new Date().getDate() * 17 + new Date().getMonth() * 53;
    const shuffled = [...withSprites].sort(
      (a, b) => ((a.id * 1327 + dayOffset) % 997) - ((b.id * 1327 + dayOffset) % 997)
    );

    this.bgSilhouettes = shuffled.slice(0, 16).map((species, i) => ({
      species,
      styles: {
        top: (5 + (i * 13 + 7) % 82) + '%',
        animationDuration: (16 + (i * 2.3) % 16) + 's',
        animationDelay: (-(i * 2.1) % 18) + 's',
        opacity: String(0.07 + (i % 4) * 0.035),
        width: (60 + (i % 4) * 18) + 'px',
        height: (60 + (i % 4) * 18) + 'px',
      },
    }));

    // Each sprite cell is 84px wide + 8px gap = 92px effective.
    // One copy must be wider than the viewport so the translateX(-50%)
    // loop fills the screen at every point of the animation.
    const viewportW = isPlatformBrowser(this.platformId) ? window.innerWidth : 1920;
    const perRow = Math.max(40, Math.ceil(viewportW / 92) + 10);

    this.marqueeRow1 = shuffled.slice(16, 16 + perRow);
    this.marqueeRow2 = shuffled.slice(16 + perRow, 16 + perRow * 2);
  }

  private buildRecentSpecies(): void {
    this.recentSpeciesData = this.recentlyViewed
      .map(entry => {
        const species = this.allSpecies.find(s => s.id === entry.id);
        if (!species) return null;
        return { species, pokemon: species.pokemons[0] };
      })
      .filter((e): e is DisplayEntry => !!e);
  }

  private initGenTiles(): void {
    const countByGen = new Map<number, number>();

    for (const s of this.allSpecies) {
      const genId = s.generation?.id;
      if (!genId) continue;
      countByGen.set(genId, (countByGen.get(genId) ?? 0) + 1);
    }

    this.genTiles = GENERATION_INFO
      .filter(info => countByGen.has(info.id))
      .map(info => {
        const sp = this.allSpecies.find(s => s.id === info.legendaryId);
        const sprites = sp?.pokemons?.[0]?.pokemonsprites?.[0]?.sprites;
        const style = this.settingsService.getSetting<string>('spriteStyle');
        const spriteUrl = style === 'home'
          ? (sprites?.other?.home?.front_default || sprites?.other?.['official-artwork']?.front_default || '')
          : style === 'pixel'
            ? (sprites?.front_default || '')
            : (sprites?.other?.['official-artwork']?.front_default || sprites?.other?.home?.front_default || '');
        return { ...info, count: countByGen.get(info.id) ?? 0, spriteUrl };
      });
  }

  // ── Filter logic ───────────────────────────────────────────────────────────

  private applyFilters(): DisplayEntry[] {
    const result: DisplayEntry[] = [];
    const formDef = this.formFilter !== null
      ? FORM_FILTER_OPTIONS.find(f => f.value === this.formFilter) ?? null
      : null;

    for (const s of this.allSpecies) {
      if (this.genFilter !== null && s.generation?.id !== this.genFilter) continue;

      // Determine displayed candidates first — type filter applies only to these
      let candidates: Pokemon[];
      if (formDef) {
        candidates = s.pokemons.filter(p => formDef.test(p.name) && this.hasSprite(p));
        // For regional filters (alola/galar/hisui/paldea), prefer the exact base form
        // (darmanitan-galar) over battle sub-forms (darmanitan-galar-zen).
        // If no exact base exists, keep all sub-forms — handles Paldean Tauros which
        // has no plain tauros-paldea but has combat/blaze/aqua variants.
        if (['alola', 'galar', 'hisui', 'paldea'].includes(formDef.value) && candidates.length > 1) {
          const base = candidates.filter(p => p.name === `${s.name}-${formDef.value}`);
          if (base.length > 0) candidates = base;
        }
      } else {
        candidates = s.pokemons[0] ? [s.pokemons[0]] : [];
      }

      if (candidates.length === 0) continue;

      // Type filter against displayed candidates only
      if (this.type1Filter !== null) {
        candidates = candidates.filter(p => {
          const ids = p.pokemontypes?.map(pt => pt.type.id) ?? [];
          return this.type2Filter !== null
            ? ids.includes(this.type1Filter!) && ids.includes(this.type2Filter!)
            : ids.includes(this.type1Filter!);
        });
        if (candidates.length === 0) continue;
      }

      for (const pokemon of candidates) result.push({ species: s, pokemon });
    }

    return result;
  }

  // ── Layout ─────────────────────────────────────────────────────────────────

  private scheduleLayout = () => {
    if (this.rafId) this.safeCancel(this.rafId);
    this.rafId = this.safeRaf(() => {
      this.rafId = 0;
      this.updateLayout();
      this.safeRaf(() => this.updateLayout());
    });
  };

  private updateLayout(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const cols = this.calculateCardsPerRow();
    if (cols !== this.cardsPerRow) {
      this.cardsPerRow = cols;
      this.updateRows();
    }

    const { visual, itemSize } = this.calculateHeightsByAspect();

    let dirty = false;
    if (visual !== this.rowVisualHeight) { this.rowVisualHeight = visual; dirty = true; }
    if (itemSize !== this.itemSize) { this.itemSize = itemSize; dirty = true; }
    if (dirty) {
      this.applyCssVars();
      this.cdr.detectChanges();
      queueMicrotask(() => this.viewport?.checkViewportSize());
    }
  }

  private applyCssVars(): void {
    const root = document.documentElement;
    root.style.setProperty('--cards-per-row', String(this.cardsPerRow));
    root.style.setProperty('--row-height', `${this.rowVisualHeight}px`);
  }

  private getContainerWidth(): number {
    return (
      this.rowContainer?.nativeElement?.clientWidth ??
      this.viewport?.elementRef?.nativeElement?.clientWidth ??
      window.innerWidth
    );
  }

  private calculateCardsPerRow(): number {
    const w = this.getContainerWidth();
    const gap = 24;
    const minCard = 220;
    const cols = Math.floor((w + gap) / (minCard + gap));
    return Math.max(2, Math.min(10, cols));
  }

  private calculateHeightsByAspect(): { visual: number; itemSize: number } {
    const row = document.querySelector<HTMLElement>('.row');
    const rowClient = row?.clientWidth ?? 0;
    const viewportClient = this.viewport?.elementRef?.nativeElement?.clientWidth ?? 0;
    const rowWidth = rowClient > 0 ? rowClient : (viewportClient > 0 ? viewportClient : window.innerWidth);
    const cs = row ? getComputedStyle(row) : null;
    const gapX = cs ? parseFloat(cs.getPropertyValue('column-gap') || cs.getPropertyValue('gap')) || 0 : 0;
    const available = rowWidth - gapX * Math.max(0, this.cardsPerRow - 1);
    const cardWidth = available / this.cardsPerRow;
    let visual = cardWidth / this.CARD_ASPECT_RATIO;
    const sampleCard = row?.querySelector<HTMLElement>('app-pokemon-card');
    const measured = sampleCard?.getBoundingClientRect().height ?? 0;
    if (measured > 0) visual = measured;
    const mTop = cs ? parseFloat(cs.getPropertyValue('margin-block-start') || cs.marginTop || '0') : 0;
    const mBottom = cs ? parseFloat(cs.getPropertyValue('margin-block-end') || cs.marginBottom || '0') : 0;
    const collapsed = Math.max(mTop, mBottom);
    return { visual: Math.ceil(visual), itemSize: Math.ceil(visual + collapsed) };
  }

  private fetchAllPokemon(): void {
    this.isLoadingSubject.next(true);
    this.pokemonService.getAllPokemonSpecies().pipe(
      finalize(() => this.isLoadingSubject.next(false)),
      catchError(error => {
        console.error('Error fetching Pokémon species:', error);
        return of({ pokemonspecies: [], pokemonspecies_aggregate: { aggregate: { count: 0 } } });
      })
    ).subscribe(response => {
      this.allSpecies = response.pokemonspecies;
      this.count = response.pokemonspecies_aggregate.aggregate.count;

      const genMap = new Map<number, Generation>();
      for (const s of this.allSpecies) {
        if (s.generation && !genMap.has(s.generation.id)) genMap.set(s.generation.id, s.generation);
      }
      this.availableGenerations = [...genMap.values()].sort((a, b) => a.id - b.id);

      this.buildRecentSpecies();
      this.initShowcases();
      this.initGenTiles();
      this.updateRows();
      if (isPlatformBrowser(this.platformId)) this.safeRaf(() => this.updateLayout());
    });
  }

  private updateRows(): void {
    this._filteredEntries = this.applyFilters();
    this.speciesRowsSubject.next(this.transformToRows(this._filteredEntries, this.cardsPerRow));
  }

  private transformToRows(entries: DisplayEntry[], cardsPerRow: number): DisplayRow[] {
    return entries.reduce((acc: DisplayRow[], _, index) => {
      if (index % cardsPerRow === 0) {
        acc.push({ rowId: index / cardsPerRow, entries: entries.slice(index, index + cardsPerRow) });
      }
      return acc;
    }, []);
  }

  private safeRaf(cb: FrameRequestCallback): number {
    if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      return window.requestAnimationFrame(cb);
    }
    return setTimeout(() => cb(performance?.now?.() ?? 0), 0) as unknown as number;
  }

  private safeCancel(id: number) {
    if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined' && 'cancelAnimationFrame' in window) {
      return window.cancelAnimationFrame(id);
    }
    clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
  }
}
