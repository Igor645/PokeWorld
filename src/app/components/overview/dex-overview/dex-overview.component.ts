import {
  Component, OnInit, Inject, PLATFORM_ID, ViewChild, ChangeDetectionStrategy,
  HostListener, OnDestroy, AfterViewInit
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PokemonService } from '../../../services/pokemon.service';
import { PokemonCardComponent } from '../../shared/pokemon-card/pokemon-card.component';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { finalize, catchError } from 'rxjs/operators';
import { SpeciesRow } from '../../../models/species-row.model';
import { PokemonSpecies } from '../../../models/pokemon-species.model';
import { PokeworldSearchComponent } from "../../search/pokeworld-search/pokeworld-search.component";
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-dex-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    PokemonCardComponent,
    ScrollingModule,
    PokeworldSearchComponent,
    LoadingSpinnerComponent,
  ],
  templateUrl: './dex-overview.component.html',
  styleUrls: ['./dex-overview.component.css'],
})
export class DexOverviewComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;

  cardsPerRow = 6;
  rowVisualHeight = 350;
  itemSize = 350;
  count = 0;
  private allSpecies: PokemonSpecies[] = [];

  private CARD_ASPECT_RATIO = 5 / 7;

  private speciesRowsSubject = new BehaviorSubject<SpeciesRow[]>([]);
  speciesRows$: Observable<SpeciesRow[]> = this.speciesRowsSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(true);
  isLoading$ = this.isLoadingSubject.asObservable();

  private rafId = 0;
  private ro?: ResizeObserver;

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

  private scheduleLayout = () => {
    if (this.rafId) this.safeCancel(this.rafId);
    this.rafId = this.safeRaf(() => {
      this.rafId = 0;
      this.updateLayout();
    });
  };

  constructor(
    private pokemonService: PokemonService,
    @Inject(PLATFORM_ID) private platformId: object
  ) { }

  ngOnInit(): void {
    this.updateLayout();
    this.fetchAllPokemon();
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

  @HostListener('window:resize')
  onResize() {
    this.updateLayout();
  }

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.rafId) this.safeCancel(this.rafId);
    this.ro?.disconnect();
    window.removeEventListener('resize', this.scheduleLayout);
    window.visualViewport?.removeEventListener('resize', this.scheduleLayout);
  }

  private updateLayout(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const cols = this.calculateCardsPerRow();
    if (cols !== this.cardsPerRow) {
      this.cardsPerRow = cols;
      this.updateRows();
    }

    const { visual, itemSize } = this.calculateHeightsByAspect();

    let dirty = false;
    if (visual !== this.rowVisualHeight) {
      this.rowVisualHeight = visual;
      dirty = true;
    }
    if (itemSize !== this.itemSize) {
      this.itemSize = itemSize;
      dirty = true;
    }
    if (dirty) {
      this.applyCssVars();
      queueMicrotask(() => this.viewport?.checkViewportSize());
    }
  }

  private applyCssVars(): void {
    const root = document.documentElement;
    root.style.setProperty('--cards-per-row', String(this.cardsPerRow));
    root.style.setProperty('--row-height', `${this.rowVisualHeight}px`);
  }

  private calculateCardsPerRow(): number {
    const w = window.innerWidth;
    if (w <= 480) return 2;
    if (w <= 768) return 3;
    if (w <= 1024) return 4;
    if (w <= 1440) return 5;
    return 6;
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
        return of({
          pokemonspecies: [],
          pokemonspecies_aggregate: { aggregate: { count: 0 } }
        });
      })
    ).subscribe(response => {
      this.allSpecies = response.pokemonspecies;
      this.count = response.pokemonspecies_aggregate.aggregate.count;
      this.updateRows();
      if (isPlatformBrowser(this.platformId)) {
        this.safeRaf(() => this.updateLayout());
      }
    });
  }

  private updateRows(): void {
    this.speciesRowsSubject.next(this.transformToRows(this.allSpecies, this.cardsPerRow));
  }

  private transformToRows(species: PokemonSpecies[], cardsPerRow: number): SpeciesRow[] {
    return species.reduce((acc: SpeciesRow[], _, index) => {
      if (index % cardsPerRow === 0) {
        acc.push({
          rowId: index / cardsPerRow,
          pokemon_species: species.slice(index, index + cardsPerRow),
        });
      }
      return acc;
    }, []);
  }

  getPlaceholderArray(count: number): number[] {
    return count > 0 ? Array(count).fill(0) : [];
  }
}
