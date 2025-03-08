import { 
  Component, OnInit, Inject, PLATFORM_ID, ViewChild, ElementRef, 
  ChangeDetectionStrategy, Renderer2, HostListener, OnDestroy 
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
  @ViewChild('firstPokemonCard', { static: false }) firstPokemonCard!: ElementRef;

  pageSize = 6;
  itemSize = 370;
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
  ) {}

  ngOnInit(): void {
    this.handleResize();
    this.updateDynamicStyles();
    this.fetchAllPokemon();
  }

  @HostListener('window:resize', [])
  onResize() {
    this.handleResize();
  }

  ngOnDestroy(): void {
    // No need for manual event listener since @HostListener handles it
  }

  private getDevicePixelRatio(): number {
    return isPlatformBrowser(this.platformId) ? window.devicePixelRatio : 1;
  }

  private handleResize(): void {
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

    console.log(this.pageSize, this.itemSize)
    this.updateDynamicStyles();
  }
  
  private calculatePageSize(): number {
    if (!isPlatformBrowser(this.platformId)) return 6;
    return Math.max(1, Math.round((window.innerWidth / window.screen.availWidth) * 6));
  }
  
  private calculateItemSize(): number {
    return 370;
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
        console.error('Error fetching Pokemon species', error);
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
