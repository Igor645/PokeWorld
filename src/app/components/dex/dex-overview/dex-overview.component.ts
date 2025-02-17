import { Component, OnInit, Inject, PLATFORM_ID, ViewChild, ChangeDetectionStrategy } from '@angular/core';
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
export class DexOverviewComponent implements OnInit {
  @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;

  private readonly pageSize = 6;
  count = 0;

  private speciesRowsSubject = new BehaviorSubject<SpeciesRow[]>([]);
  speciesRows$: Observable<SpeciesRow[]> = this.speciesRowsSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(true);
  isLoading$ = this.isLoadingSubject.asObservable();

  constructor(
    private pokemonService: PokemonService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit(): void {
    this.fetchAllPokemon();
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
      const species = response.pokemon_v2_pokemonspecies;
      if (!species.length) {
        return;
      }

      const rows = this.transformToRows(species, this.pageSize);
      this.speciesRowsSubject.next(rows);
      this.count = response.pokemon_v2_pokemonspecies_aggregate.aggregate.count;
    });
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
}
