import { Component, OnInit, Inject, PLATFORM_ID, ViewChild, AfterViewInit, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PokemonService } from '../../../services/pokemon.service';
import { PokemonCardComponent } from '../pokemon-card/pokemon-card.component';
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
export class DexOverviewComponent implements OnInit, AfterViewInit {
  @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;
  @ViewChild('firstPokemonCard', { static: false }) firstPokemonCard!: ElementRef;

  pageSize = 6;
  count = 0;
  itemSize = 370; 
   private allSpecies: PokemonSpecies[] = [];
  private lastDevicePixelRatio = window.devicePixelRatio;

  private speciesRowsSubject = new BehaviorSubject<SpeciesRow[]>([]);
  speciesRows$: Observable<SpeciesRow[]> = this.speciesRowsSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(true);
  isLoading$ = this.isLoadingSubject.asObservable();

  constructor(
    private pokemonService: PokemonService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit(): void {
    this.setPageSize();
    this.fetchAllPokemon();

    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('resize', this.handleResize);
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.updateItemSize();
    }, 0);
  }

  private updateItemSize(): void {
    if (this.firstPokemonCard && this.firstPokemonCard.nativeElement) {
        this.itemSize = this.firstPokemonCard.nativeElement.offsetHeight || 370; 
    }
  }

  private handleResize = (): void => {
    const newPageSize = this.calculatePageSize();
    const newDevicePixelRatio = window.devicePixelRatio;

    // Detect zoom change based on devicePixelRatio
    if (newPageSize !== this.pageSize || newDevicePixelRatio !== this.lastDevicePixelRatio) {
      this.pageSize = newPageSize;
      this.lastDevicePixelRatio = newDevicePixelRatio;
      this.updateRows();
    }

    this.updateItemSize();
  };

  private calculatePageSize(): number {
    const width = window.innerWidth;
    if (width <= 480) return 3;
    if (width <= 768) return 3;
    if (width <= 1024) return 4;
    if(width <= 1280) return 5;
    return 6;
  }

  private calculateItemSize(): number {
    const width = window.innerWidth;
    if (width <= 480) return 200;
    if (width <= 768) return 300;
    if (width <= 1024) return 300;
    if(width <= 1280) return 320;
    return 370;
  }

  private setPageSize(): void {
    this.pageSize = this.calculatePageSize();
    this.itemSize = this.calculateItemSize();
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
      setTimeout(() => {
        this.updateItemSize();
      }, 0);
    });
  }

  private updateRows(): void {
    const rows = this.transformToRows(this.allSpecies, this.pageSize);
    this.speciesRowsSubject.next(rows);
  }

  private transformToRows(species: PokemonSpecies[], pageSize: number): SpeciesRow[] {
    const rows: SpeciesRow[] = [];
    for (let i = 0; i < species.length; i += pageSize) {
      rows.push({
        rowId: i / pageSize,
        pokemon_species: species.slice(i, i + pageSize),
      });
    }
    return rows;
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.handleResize);
    }
  }
}
