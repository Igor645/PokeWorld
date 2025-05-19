import {
  Component, OnInit, Inject, PLATFORM_ID, ViewChild, ChangeDetectionStrategy,
  Renderer2, HostListener, OnDestroy
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
export class DexOverviewComponent implements OnInit, OnDestroy {
  @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;

  pageSize = 6;
  itemSize = 350;
  count = 0;
  private allSpecies: PokemonSpecies[] = [];
  private lastDevicePixelRatio = this.getDevicePixelRatio();

  private speciesRowsSubject = new BehaviorSubject<SpeciesRow[]>([]);
  speciesRows$: Observable<SpeciesRow[]> = this.speciesRowsSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(true);
  isLoading$ = this.isLoadingSubject.asObservable();

  constructor(
    private pokemonService: PokemonService,
    @Inject(PLATFORM_ID) private platformId: object,
    private renderer: Renderer2
  ) { }

  ngOnInit(): void {
    this.initializeView();
    this.fetchAllPokemon();
  }

  @HostListener('window:resize')
  onResize() {
    this.updateViewSettings();
  }

  ngOnDestroy(): void {
    // @HostListener handles cleanup, no need for manual event listener removal
  }

  private initializeView(): void {
    this.updateViewSettings();
  }

  private getDevicePixelRatio(): number {
    return isPlatformBrowser(this.platformId) ? window.devicePixelRatio : 1;
  }

  private updateViewSettings(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const newPageSize = this.calculatePageSize();
    const newItemSize = this.calculateItemSize();
    const newDevicePixelRatio = window.devicePixelRatio;

    if (newPageSize !== this.pageSize || newDevicePixelRatio !== this.lastDevicePixelRatio) {
      this.pageSize = newPageSize;
      this.lastDevicePixelRatio = newDevicePixelRatio;
      this.updateRows();
    }

    if (newItemSize !== this.itemSize) {
      this.itemSize = newItemSize;
    }

    this.updateDynamicStyles();
  }

  private calculatePageSize(): number {
    if (!isPlatformBrowser(this.platformId)) return 6;

    const width = window.innerWidth;
    return width <= 768
      ? Math.max(2, Math.round((width / 768) * 3))
      : Math.max(2, Math.round((width / 1920) * 6));
  }

  private calculateItemSize(): number {
    if (!isPlatformBrowser(this.platformId)) return 350;

    const width = window.innerWidth;

    if (width <= 480) return 180; // Phone
    if (width <= 1024) return 280; // Tablet
    return 350; // Desktop
  }

  private updateDynamicStyles(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const root = document.documentElement;
    root.style.setProperty('--page-size', this.pageSize.toString());
    root.style.setProperty('--item-size', `${this.itemSize}px`);
  }

  private fetchAllPokemon(): void {
    this.isLoadingSubject.next(true);

    this.pokemonService.getAllPokemonSpecies().pipe(
      finalize(() => this.isLoadingSubject.next(false)),
      catchError(error => {
        console.error('Error fetching Pokémon species:', error);
        return of({
          pokemon_v2_pokemonspecies: [],
          pokemon_v2_pokemonspecies_aggregate: { aggregate: { count: 0 } }
        });
      })
    ).subscribe(response => {
      this.allSpecies = response.pokemon_v2_pokemonspecies;
      this.count = response.pokemon_v2_pokemonspecies_aggregate.aggregate.count;
      this.updateRows();
    });
  }

  private updateRows(): void {
    this.speciesRowsSubject.next(this.transformToRows(this.allSpecies, this.pageSize));
  }

  private transformToRows(species: PokemonSpecies[], pageSize: number): SpeciesRow[] {
    return species.reduce((acc: SpeciesRow[], _, index) => {
      if (index % pageSize === 0) {
        acc.push({
          rowId: index / pageSize,
          pokemon_species: species.slice(index, index + pageSize),
        });
      }
      return acc;
    }, []);
  }
}
