import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component,
  ElementRef, EventEmitter, Inject, Input, OnChanges, OnDestroy, OnInit,
  Output, PLATFORM_ID, SimpleChanges, ViewChild
} from '@angular/core';
import { AsyncPipe, isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subscription, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { CdkVirtualScrollViewport, CdkVirtualScrollableWindow, ScrollingModule } from '@angular/cdk/scrolling';
import { MatIcon } from '@angular/material/icon';

import { Generation } from '../../../models/generation.model';
import { Pokemon } from '../../../models/pokemon.model';
import { PokemonCardComponent } from '../pokemon-card/pokemon-card.component';
import { PokemonService } from '../../../services/pokemon.service';
import { PokemonSpecies } from '../../../models/pokemon-species.model';
import { PokemonTypeComponent } from '../pokemon-type/pokemon-type.component';
import { PokemonUtilsService } from '../../../utils/pokemon-utils';
import { LoadingSpinnerComponent } from '../loading-spinner/loading-spinner.component';
import { Type } from '../../../models/type.model';
import { TypeService } from '../../../services/type.service';
import { SettingsService } from '../../../services/settings.service';
import { ItemService } from '../../../services/item.service';
import { ItemCardComponent } from '../item-card/item-card.component';

export interface DisplayEntry { species: PokemonSpecies; pokemon: Pokemon; }
interface DisplayRow { rowId: number; entries: DisplayEntry[]; }
export interface ItemDisplayEntry { item: any; }
interface ItemDisplayRow { rowId: number; entries: ItemDisplayEntry[]; }

const isRelevant = (n: string) => !n.endsWith('-totem') && !n.endsWith('-cap');

const FORM_FILTER_OPTIONS = [
  { value: 'mega'   as const, label: 'Mega',       test: (n: string) => n.includes('-mega') },
  { value: 'gmax'   as const, label: 'Gigantamax', test: (n: string) => n.endsWith('-gmax') },
  { value: 'alola'  as const, label: 'Alolan',     test: (n: string) => n.includes('-alola') && isRelevant(n) },
  { value: 'galar'  as const, label: 'Galarian',   test: (n: string) => n.includes('-galar') && !n.endsWith('-zen') },
  { value: 'hisui'  as const, label: 'Hisuian',    test: (n: string) => n.includes('-hisui') },
  { value: 'paldea' as const, label: 'Paldean',    test: (n: string) => n.includes('-paldea') },
];
type FormFilterValue = typeof FORM_FILTER_OPTIONS[number]['value'];
type FormFilter = FormFilterValue | 'all' | null;

export interface DexPreset {
  lockedTypeId?: number;
  lockedGenId?: number;
  title?: string;
  defaultFormFilter?: 'all';
}

@Component({
  selector: 'app-pokemon-dex',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    MatIcon,
    PokemonCardComponent,
    ItemCardComponent,
    PokemonTypeComponent,
    ScrollingModule,
    CdkVirtualScrollableWindow,
    LoadingSpinnerComponent,
  ],
  templateUrl: './pokemon-dex.component.html',
  styleUrls: ['./pokemon-dex.component.css'],
})
export class PokemonDexComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @ViewChild(CdkVirtualScrollViewport) viewport?: CdkVirtualScrollViewport;

  @Input() preset?: DexPreset;
  @Input() genFilter: number | null = null;
  @Output() genFilterChange = new EventEmitter<number | null>();
  @Input() showFilters = true;
  @Input() mode: 'pokemon' | 'item' = 'pokemon';

  cardsPerRow = 5;
  rowHeight = 280;

  // Pokemon mode
  count = 0;
  availableGenerations: Generation[] = [];
  allTypes: Type[] = [];
  readonly formFilterOptions = FORM_FILTER_OPTIONS;

  activeGenFilter: number | null = null;
  type1Filter: number | null = null;
  type2Filter: number | null = null;
  formFilter: FormFilter = null;
  activeSlotFilter: null | 'mono' | 'primary' | 'secondary' = null;

  get filteredCount(): number { return this._filteredEntries.length; }
  private get defaultForm(): FormFilter { return this.preset?.defaultFormFilter ?? null; }
  get hasActiveFilters(): boolean {
    return !!(this.activeGenFilter || this.type1Filter || this.type2Filter ||
              (this.formFilter !== this.defaultForm ? this.formFilter : null) ||
              this.activeSlotFilter);
  }

  private allSpecies: PokemonSpecies[] = [];
  private _filteredEntries: DisplayEntry[] = [];
  private _lockedTypeBaseCount = 0;
  get lockedTypeBaseCount(): number { return this._lockedTypeBaseCount; }
  private rowsSubject = new BehaviorSubject<DisplayRow[]>([]);
  speciesRows$: Observable<DisplayRow[]> = this.rowsSubject.asObservable();

  // Item mode
  allItems: any[] = [];
  availablePockets: any[] = [];
  activePocketFilter: number | null = null;
  private _filteredItemEntries: ItemDisplayEntry[] = [];
  private itemRowsSubject = new BehaviorSubject<ItemDisplayRow[]>([]);
  itemRows$: Observable<ItemDisplayRow[]> = this.itemRowsSubject.asObservable();
  get filteredItemCount(): number { return this._filteredItemEntries.length; }
  get hasActivePocketFilter(): boolean { return this.activePocketFilter !== null; }

  private isLoadingSubject = new BehaviorSubject<boolean>(true);
  isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();

  private rafId = 0;
  private ro?: ResizeObserver;
  private langSub?: Subscription;
  private spriteStyleSub?: Subscription;

  constructor(
    private pokemonService: PokemonService,
    private typeService: TypeService,
    private itemService: ItemService,
    public pokemonUtils: PokemonUtilsService,
    private settingsService: SettingsService,
    private cdr: ChangeDetectorRef,
    private el: ElementRef<HTMLElement>,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mode'] && !changes['mode'].firstChange) {
      if (this.mode === 'item' && !this.allItems.length) {
        this.fetchAllItems();
      } else if (this.mode === 'pokemon') {
        this.updateLayout();
      }
      return;
    }
    if (this.mode !== 'pokemon') return;
    if (changes['genFilter'] && !changes['genFilter'].firstChange) {
      const incoming = this.genFilter;
      if (incoming !== this.activeGenFilter) {
        this.activeGenFilter = incoming;
        if (this.allSpecies.length) this.updateRows(true);
      }
    }
    if (changes['preset'] && !changes['preset'].firstChange) {
      const prev = changes['preset'].previousValue as DexPreset | undefined;
      const curr = changes['preset'].currentValue as DexPreset | undefined;
      if (prev?.lockedTypeId !== curr?.lockedTypeId) {
        this.activeSlotFilter = null;
        this.formFilter = curr?.defaultFormFilter ?? null;
      }
      if (this.allSpecies.length) this.updateRows();
    }
  }

  ngOnInit(): void {
    this.activeGenFilter = this.genFilter;
    this.formFilter = this.defaultForm;

    if (this.mode === 'pokemon') {
      this.fetchAllPokemon();
      this.typeService.getAllTypes().pipe(
        map((res: any) => res.type.filter((t: Type) => t.id >= 1 && t.id <= 18))
      ).subscribe((types: Type[]) => {
        this.allTypes = types;
        this.cdr.detectChanges();
      });
    } else {
      this.fetchAllItems();
    }

    this.langSub = this.pokemonUtils.watchLanguageChanges().subscribe(() => {
      if (this.mode === 'item') this.updateItemRows();
      this.cdr.detectChanges();
    });
    this.spriteStyleSub = this.settingsService.watchSetting<string>('spriteStyle').subscribe(() => this.cdr.detectChanges());
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.ro = new ResizeObserver(this.scheduleLayout);
    this.ro.observe(this.el.nativeElement);
    window.addEventListener('resize', this.scheduleLayout, { passive: true });
    this.safeRaf(this.scheduleLayout);
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
    this.spriteStyleSub?.unsubscribe();
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.ro?.disconnect();
    window.removeEventListener('resize', this.scheduleLayout);
  }

  // ── Pokemon filters ──────────────────────────────────────────────────────

  setGenFilter(genId: number | null): void {
    this.activeGenFilter = genId;
    this.genFilterChange.emit(genId);
    this.updateRows(true);
  }

  onTypeClick(typeId: number): void {
    if (this.type1Filter === typeId) { this.type1Filter = null; this.type2Filter = null; }
    else if (this.type2Filter === typeId) { this.type2Filter = null; }
    else if (this.type1Filter === null) { this.type1Filter = typeId; }
    else { this.type2Filter = typeId; }
    this.updateRows(true);
  }

  setFormFilter(value: FormFilter): void {
    this.formFilter = value;
    this.updateRows(true);
  }

  setSlotFilter(slot: null | 'mono' | 'primary' | 'secondary'): void {
    this.activeSlotFilter = slot;
    this.updateRows(true);
  }

  clearFilters(): void {
    this.activeGenFilter = null;
    this.type1Filter = null;
    this.type2Filter = null;
    this.formFilter = this.defaultForm;
    this.activeSlotFilter = null;
    this.genFilterChange.emit(null);
    this.updateRows(true);
  }

  // ── Item filters ─────────────────────────────────────────────────────────

  setPocketFilter(pocketId: number | null): void {
    this.activePocketFilter = pocketId;
    this.updateItemRows(true);
  }

  getPocketLabel(pocket: any): string {
    return this.pokemonUtils.getLocalizedNameFromEntity(pocket, 'itempocketnames');
  }

  // ── Utilities ────────────────────────────────────────────────────────────

  getRomanForGenId(id: number): string {
    return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][id - 1] ?? `Gen ${id}`;
  }

  getPlaceholderArray(n: number): number[] {
    return n > 0 ? Array(n).fill(0) : [];
  }

  trackRow(_: number, row: DisplayRow | ItemDisplayRow): number { return row.rowId; }

  // ── Layout ───────────────────────────────────────────────────────────────

  private scheduleLayout = (): void => {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = this.safeRaf(() => {
      this.rafId = 0;
      this.updateLayout();
    });
  };

  private updateLayout(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const w = this.el.nativeElement.clientWidth;
    if (!w) return;

    const cols = this.computeCols(w);
    const rh = this.computeRowHeight(w, cols);
    const colsChanged = cols !== this.cardsPerRow;

    this.cardsPerRow = cols;
    this.rowHeight = rh;
    document.documentElement.style.setProperty('--cards-per-row', String(cols));

    if (colsChanged) {
      this.mode === 'pokemon' ? this.updateRows() : this.updateItemRows();
    } else {
      this.cdr.detectChanges();
      this.viewport?.checkViewportSize();
    }
  }

  private computeCols(viewportWidth: number): number {
    const gap = 24, minCard = 180;
    return Math.max(2, Math.min(10, Math.floor((viewportWidth - 48 + gap) / (minCard + gap))));
  }

  private computeRowHeight(viewportWidth: number, cols: number): number {
    const sidePad = 24, gap = 24, rowPad = 24;
    const available = viewportWidth - 2 * sidePad - (cols - 1) * gap;
    return Math.round((available / cols) * (7 / 5) + rowPad);
  }

  // ── Data fetching ────────────────────────────────────────────────────────

  private fetchAllPokemon(): void {
    this.isLoadingSubject.next(true);
    this.pokemonService.getAllPokemonSpecies().pipe(
      finalize(() => this.isLoadingSubject.next(false)),
      catchError(err => {
        console.error('Error fetching species:', err);
        return of({ pokemonspecies: [], pokemonspecies_aggregate: { aggregate: { count: 0 } } });
      }),
    ).subscribe(response => {
      this.allSpecies = response.pokemonspecies;
      this.count = response.pokemonspecies_aggregate.aggregate.count;

      const genMap = new Map<number, Generation>();
      for (const s of this.allSpecies) {
        if (s.generation && !genMap.has(s.generation.id)) genMap.set(s.generation.id, s.generation);
      }
      this.availableGenerations = [...genMap.values()].sort((a, b) => a.id - b.id);

      this.updateRows();
      if (isPlatformBrowser(this.platformId)) this.safeRaf(() => this.updateLayout());
    });
  }

  private fetchAllItems(): void {
    this.isLoadingSubject.next(true);
    this.itemService.getAllItems().pipe(
      finalize(() => this.isLoadingSubject.next(false)),
      catchError(() => of({ item: [] })),
    ).subscribe(response => {
      this.allItems = response.item;
      this.buildAvailablePockets();
      this.updateItemRows();
      if (isPlatformBrowser(this.platformId)) this.safeRaf(() => this.updateLayout());
    });
  }

  private buildAvailablePockets(): void {
    const seen = new Map<number, any>();
    for (const item of this.allItems) {
      const pocket = item?.itemcategory?.itempocket;
      if (pocket && !seen.has(pocket.id)) seen.set(pocket.id, pocket);
    }
    this.availablePockets = [...seen.values()].sort((a, b) => a.id - b.id);
  }

  // ── Row computation ───────────────────────────────────────────────────────

  private updateRows(resetScroll = false): void {
    this._filteredEntries = this.applyFilters();
    if (this.preset?.lockedTypeId && !this.activeGenFilter && !this.formFilter && !this.activeSlotFilter) {
      this._lockedTypeBaseCount = this._filteredEntries.length;
    }
    this.rowsSubject.next(this.toRows(this._filteredEntries, this.cardsPerRow));
    if (resetScroll) this.safeRaf(() => {
      window.scrollTo({ top: this.el.nativeElement.offsetTop, behavior: 'smooth' });
    });
    this.cdr.detectChanges();
  }

  private updateItemRows(resetScroll = false): void {
    this._filteredItemEntries = this.applyItemFilters();
    this.itemRowsSubject.next(this.toItemRows(this._filteredItemEntries, this.cardsPerRow));
    if (resetScroll) this.safeRaf(() => {
      window.scrollTo({ top: this.el.nativeElement.offsetTop, behavior: 'smooth' });
    });
    this.cdr.detectChanges();
  }

  private applyFilters(): DisplayEntry[] {
    const effectiveGenId = this.preset?.lockedGenId ?? this.activeGenFilter;
    const lockedTypeId = this.preset?.lockedTypeId ?? null;
    const formDef = (this.formFilter && this.formFilter !== 'all')
      ? FORM_FILTER_OPTIONS.find(f => f.value === this.formFilter) ?? null
      : null;

    const result: DisplayEntry[] = [];

    for (const s of this.allSpecies) {
      if (effectiveGenId !== null && s.generation?.id !== effectiveGenId) continue;

      let candidates: Pokemon[];
      if (this.formFilter === 'all') {
        candidates = s.pokemons.filter(p => this.pokemonUtils.isRelevantForm(p.name) && this.hasSprite(p));
      } else if (formDef) {
        candidates = s.pokemons.filter(p => formDef.test(p.name) && this.hasSprite(p));
        if (['alola', 'galar', 'hisui', 'paldea'].includes(formDef.value) && candidates.length > 1) {
          const base = candidates.filter(p => p.name === `${s.name}-${formDef.value}`);
          if (base.length > 0) candidates = base;
        }
      } else {
        candidates = s.pokemons[0] ? [s.pokemons[0]] : [];
      }

      if (candidates.length === 0) continue;

      const typeConstraints = [this.type1Filter, this.type2Filter]
        .filter((t): t is number => t !== null);

      if (lockedTypeId !== null) {
        const slot = this.activeSlotFilter;
        candidates = candidates.filter(p => {
          const types = p.pokemontypes ?? [];
          if (slot === 'mono')      return types.length === 1 && types[0]?.type.id === lockedTypeId;
          if (slot === 'primary')   return types.length > 1 && types[0]?.type.id === lockedTypeId;
          if (slot === 'secondary') return types.length > 1 && types[1]?.type.id === lockedTypeId;
          return types.some(pt => pt.type.id === lockedTypeId);
        });
        if (candidates.length === 0) continue;
      }

      if (typeConstraints.length > 0) {
        candidates = candidates.filter(p => {
          const ids = p.pokemontypes?.map(pt => pt.type.id) ?? [];
          return typeConstraints.every(tf => ids.includes(tf));
        });
        if (candidates.length === 0) continue;
      }

      for (const pokemon of candidates) result.push({ species: s, pokemon });
    }
    return result;
  }

  private applyItemFilters(): ItemDisplayEntry[] {
    if (this.activePocketFilter === null) return this.allItems.map(item => ({ item }));
    return this.allItems
      .filter(item => item?.itemcategory?.itempocket?.id === this.activePocketFilter)
      .map(item => ({ item }));
  }

  private toRows(entries: DisplayEntry[], cpr: number): DisplayRow[] {
    return entries.reduce((acc: DisplayRow[], _, i) => {
      if (i % cpr === 0) acc.push({ rowId: i / cpr, entries: entries.slice(i, i + cpr) });
      return acc;
    }, []);
  }

  private toItemRows(entries: ItemDisplayEntry[], cpr: number): ItemDisplayRow[] {
    return entries.reduce((acc: ItemDisplayRow[], _, i) => {
      if (i % cpr === 0) acc.push({ rowId: i / cpr, entries: entries.slice(i, i + cpr) });
      return acc;
    }, []);
  }

  private hasSprite(p: Pokemon): boolean {
    const s = p.pokemonsprites?.[0]?.sprites;
    return !!(s?.front_default || s?.other?.['official-artwork']?.front_default);
  }

  private safeRaf(cb: FrameRequestCallback): number {
    return isPlatformBrowser(this.platformId)
      ? window.requestAnimationFrame(cb)
      : setTimeout(() => cb(0), 0) as unknown as number;
  }
}
