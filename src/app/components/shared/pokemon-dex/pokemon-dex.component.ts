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

export interface DisplayEntry { species: PokemonSpecies; pokemon: Pokemon; }
interface DisplayRow { rowId: number; entries: DisplayEntry[]; }

const FORM_FILTER_OPTIONS = [
  { value: 'mega'   as const, label: 'Mega',       test: (n: string) => n.includes('-mega') },
  { value: 'gmax'   as const, label: 'Gigantamax', test: (n: string) => n.endsWith('-gmax') },
  { value: 'alola'  as const, label: 'Alolan',     test: (n: string) => n.includes('-alola') && !n.endsWith('-totem') && !n.endsWith('-cap') },
  { value: 'galar'  as const, label: 'Galarian',   test: (n: string) => n.includes('-galar') && !n.endsWith('-zen') },
  { value: 'hisui'  as const, label: 'Hisuian',    test: (n: string) => n.includes('-hisui') },
  { value: 'paldea' as const, label: 'Paldean',    test: (n: string) => n.includes('-paldea') },
];
type FormFilterValue = typeof FORM_FILTER_OPTIONS[number]['value'];

export interface DexPreset {
  lockedTypeId?: number;
  lockedGenId?: number;
  title?: string;
}

@Component({
  selector: 'app-pokemon-dex',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    MatIcon,
    PokemonCardComponent,
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

  cardsPerRow = 5;
  rowHeight = 280;

  count = 0;
  availableGenerations: Generation[] = [];
  allTypes: Type[] = [];
  readonly formFilterOptions = FORM_FILTER_OPTIONS;

  activeGenFilter: number | null = null;
  type1Filter: number | null = null;
  type2Filter: number | null = null;
  formFilter: FormFilterValue | null = null;

  get filteredCount(): number { return this._filteredEntries.length; }
  get hasActiveFilters(): boolean {
    return !!(this.activeGenFilter || this.type1Filter || this.type2Filter || this.formFilter);
  }

  private allSpecies: PokemonSpecies[] = [];
  private _filteredEntries: DisplayEntry[] = [];

  private rowsSubject = new BehaviorSubject<DisplayRow[]>([]);
  speciesRows$: Observable<DisplayRow[]> = this.rowsSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(true);
  isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();

  private rafId = 0;
  private ro?: ResizeObserver;
  private langSub?: Subscription;
  private spriteStyleSub?: Subscription;

  constructor(
    private pokemonService: PokemonService,
    private typeService: TypeService,
    public pokemonUtils: PokemonUtilsService,
    private settingsService: SettingsService,
    private cdr: ChangeDetectorRef,
    private el: ElementRef<HTMLElement>,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['genFilter'] && !changes['genFilter'].firstChange) {
      const incoming = this.genFilter;
      if (incoming !== this.activeGenFilter) {
        this.activeGenFilter = incoming;
        if (this.allSpecies.length) this.updateRows(true);
      }
    }
    if (changes['preset'] && !changes['preset'].firstChange) {
      if (this.allSpecies.length) this.updateRows();
    }
  }

  ngOnInit(): void {
    this.activeGenFilter = this.genFilter;
    this.fetchAllPokemon();
    this.typeService.getAllTypes().pipe(
      map((res: any) => res.type.filter((t: Type) => t.id >= 1 && t.id <= 18))
    ).subscribe((types: Type[]) => {
      this.allTypes = types;
      this.cdr.detectChanges();
    });
    this.langSub = this.pokemonUtils.watchLanguageChanges().subscribe(() => this.cdr.detectChanges());
    this.spriteStyleSub = this.settingsService.watchSetting<string>('spriteStyle').subscribe(() => this.cdr.detectChanges());
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    // Observe the HOST element — CDK never modifies it, so no feedback loop.
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

  setFormFilter(value: FormFilterValue | null): void {
    this.formFilter = value;
    this.updateRows(true);
  }

  clearFilters(): void {
    this.activeGenFilter = null;
    this.type1Filter = null;
    this.type2Filter = null;
    this.formFilter = null;
    this.genFilterChange.emit(null);
    this.updateRows(true);
  }

  getRomanForGenId(id: number): string {
    return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][id - 1] ?? `Gen ${id}`;
  }

  getPlaceholderArray(n: number): number[] {
    return n > 0 ? Array(n).fill(0) : [];
  }

  trackRow(_: number, row: DisplayRow): number { return row.rowId; }

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
      this.updateRows();
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
    const sidePad = 24, gap = 24, rowPad = 24; // rowPad = top = bottom per row
    const available = viewportWidth - 2 * sidePad - (cols - 1) * gap;
    return Math.round((available / cols) * (7 / 5) + rowPad);
  }

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

  private updateRows(resetScroll = false): void {
    this._filteredEntries = this.applyFilters();
    this.rowsSubject.next(this.toRows(this._filteredEntries, this.cardsPerRow));
    if (resetScroll) this.safeRaf(() => {
      // With scrollWindow the scroller is window — scroll to the top of the host.
      window.scrollTo({ top: this.el.nativeElement.offsetTop, behavior: 'smooth' });
    });
    this.cdr.detectChanges();
  }

  private applyFilters(): DisplayEntry[] {
    const effectiveGenId = this.preset?.lockedGenId ?? this.activeGenFilter;
    const lockedTypeId = this.preset?.lockedTypeId ?? null;
    const formDef = this.formFilter
      ? FORM_FILTER_OPTIONS.find(f => f.value === this.formFilter) ?? null
      : null;

    const result: DisplayEntry[] = [];

    for (const s of this.allSpecies) {
      if (effectiveGenId !== null && s.generation?.id !== effectiveGenId) continue;

      let candidates: Pokemon[];
      if (formDef) {
        candidates = s.pokemons.filter(p => formDef.test(p.name) && this.hasSprite(p));
        if (['alola', 'galar', 'hisui', 'paldea'].includes(formDef.value) && candidates.length > 1) {
          const base = candidates.filter(p => p.name === `${s.name}-${formDef.value}`);
          if (base.length > 0) candidates = base;
        }
      } else {
        candidates = s.pokemons[0] ? [s.pokemons[0]] : [];
      }

      if (candidates.length === 0) continue;

      const typeConstraints = [lockedTypeId, this.type1Filter, this.type2Filter]
        .filter((t): t is number => t !== null);

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

  private toRows(entries: DisplayEntry[], cpr: number): DisplayRow[] {
    return entries.reduce((acc: DisplayRow[], _, i) => {
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
