import { Component, OnInit, Inject, PLATFORM_ID, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PokemonService } from '../../../services/pokemon.service';
import { PokemonCardComponent } from '../pokemon-card/pokemon-card.component';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map, tap, startWith } from 'rxjs/operators';
import { SpeciesRow } from '../../../models/species-row.model';
import { PokemonSpecies } from '../../../models/pokemon-species.model';
import { PokeworldSearchComponent } from "../../search/pokeworld-search/pokeworld-search.component";
import { LanguageSelectorComponent } from '../../localization/language-selector/language-selector.component';
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

  private pageSize = 6;

  count = 0;

  private speciesRowsSubject = new BehaviorSubject<SpeciesRow[]>([]);
  speciesRows$: Observable<SpeciesRow[]> = this.speciesRowsSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(true);
  isLoading$ = this.isLoadingSubject.asObservable();

  constructor(
    private pokemonService: PokemonService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit() {
    this.fetchAllPokemon();
  }

  private fetchAllPokemon() {
    this.isLoadingSubject.next(true);

    this.pokemonService.getAllPokemonSpecies().subscribe({
      next: response => {
        if (!response.pokemon_v2_pokemonspecies.length) {
          this.isLoadingSubject.next(false);
          return;
        }

        const rows: SpeciesRow[] = [];
        for (let i = 0; i < response.pokemon_v2_pokemonspecies.length; i += this.pageSize) {
          rows.push({
            rowId: i / this.pageSize,
            pokemon_species: response.pokemon_v2_pokemonspecies.slice(i, i + this.pageSize),
          });
        }

        this.speciesRowsSubject.next(rows);
        this.count = response.pokemon_v2_pokemonspecies_aggregate.aggregate.count;
        this.isLoadingSubject.next(false);
      },
      error: () => this.isLoadingSubject.next(false),
    });
  }
}
