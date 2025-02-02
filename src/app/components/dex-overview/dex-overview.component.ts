import { Component, OnInit, Inject, PLATFORM_ID, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PokemonService } from '../../services/pokemon.service';
import { PokemonCardComponent } from '../pokemon-card/pokemon-card.component';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { ScrollingModule as ExperimentalScrollingModule } from '@angular/cdk-experimental/scrolling';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap, filter } from 'rxjs/operators';
import { SpeciesRow } from '../../models/species-row.model';
import { PokemonSpecies } from '../../models/pokemon-species.model';
import { PokeworldSearchComponent } from "../pokeworld-search/pokeworld-search.component";
import { ScrollToTopComponent } from "../scroll-to-top/scroll-to-top.component";

@Component({
  selector: 'app-dex-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, PokemonCardComponent, ScrollingModule, ExperimentalScrollingModule, PokeworldSearchComponent, ScrollToTopComponent],
  templateUrl: './dex-overview.component.html',
  styleUrls: ['./dex-overview.component.css'],
})
export class DexOverviewComponent implements OnInit {
  @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;

  private pageSize = 6;
  private currentPage = 0;
  private isLoading = false;

  count = 0;

  private speciesRowsSubject = new BehaviorSubject<SpeciesRow[]>([]);
  speciesRows$: Observable<SpeciesRow[]> = this.speciesRowsSubject.asObservable();

  filteredPokemonSpecies: PokemonSpecies[] = [];
  showDropdown = false;
  searchQuery = '';
  showScrollToTopButton = false;

  constructor(
    private pokemonService: PokemonService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit() {
    this.fetchAllPokemon();
  }

  private fetchAllPokemon() {
    this.pokemonService.getAllPokemonSpecies().subscribe({
      next: response => {
        if (!response.pokemon_v2_pokemonspecies.length) return;

        const rows: SpeciesRow[] = [];
        for (let i = 0; i < response.pokemon_v2_pokemonspecies.length; i += this.pageSize) {
          rows.push({
            rowId: i / this.pageSize,
            pokemon_species: response.pokemon_v2_pokemonspecies.slice(i, i + this.pageSize),
          });
        }

        this.speciesRowsSubject.next(rows);
        this.count = response.pokemon_v2_pokemonspecies_aggregate.aggregate.count;
        this.isLoading = false;
      },
      error: () => (this.isLoading = false),
    });
  }
}
