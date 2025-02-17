import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of, BehaviorSubject } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PokemonService } from '../../../services/pokemon.service';
import { PokemonSpecies } from '../../../models/pokemon-species.model';
import { Version } from '../../../models/version.model';
import { CommonModule } from '@angular/common';
import { PokemonUtilsService } from '../../../utils/pokemon-utils';
import { PokemonBgSvgComponent } from '../../shared/pokemon-bg-svg/pokemon-bg-svg.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { DexEntryComponent } from '../dex-entry/dex-entry.component';
import { PokemonNavigatorComponent } from '../pokemon-navigator/pokemon-navigator.component';

@Component({
  selector: 'app-pokemon-details',
  standalone: true,
  imports: [
    CommonModule,
    PokemonBgSvgComponent,
    PokemonNavigatorComponent,
    LoadingSpinnerComponent,
    DexEntryComponent
  ],
  templateUrl: './pokemon-details.component.html',
  styleUrls: ['./pokemon-details.component.css']
})
export class PokemonDetailsComponent implements OnInit {
  pokemonSpeciesDetails?: PokemonSpecies;
  selectedPokemonImage?: string;

  previousPokemonSpecies?: PokemonSpecies;
  nextPokemonSpecies?: PokemonSpecies;

  versions: Version[] = [];
  selectedVersion: Version | null = null;

  private selectedLanguageId$ = new BehaviorSubject<number>(9);

  isMainLoading = true;
  isAdjacentLoading = true;

  get isLoading(): boolean {
    return this.isMainLoading || this.isAdjacentLoading;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pokemonService: PokemonService,
    public pokemonUtils: PokemonUtilsService
  ) {}

  ngOnInit() {
    this.subscribeToRouteChanges();
  }

  private subscribeToRouteChanges(): void {
    this.route.paramMap.subscribe(params => {
      this.pokemonSpeciesDetails = undefined;
      this.previousPokemonSpecies = undefined;
      this.nextPokemonSpecies = undefined;
      this.isMainLoading = true;
      this.isAdjacentLoading = true;

      const speciesIdOrName = params.get('speciesIdOrName');
      if (!speciesIdOrName) {
        console.error("No speciesIdOrName found in the route!");
        this.router.navigate(['/']);
        return;
      }

      const isId = /^\d+$/.test(speciesIdOrName);
      if (isId) {
        this.fetchPokemonDetails(parseInt(speciesIdOrName, 10));
      } else {
        this.fetchPokemonDetailsByName(speciesIdOrName);
      }
    });
  }

  fetchPokemonDetails(id: number) {
    this.pokemonService.getPokemonDetails(id, undefined).subscribe({
      next: (response) => {
        this.pokemonSpeciesDetails = response.pokemon_v2_pokemonspecies[0];
        this.selectedPokemonImage = this.pokemonUtils.getPokemonOfficialImage(
          this.pokemonSpeciesDetails?.pokemon_v2_pokemons?.[0]
        );
        this.isMainLoading = false;

        if (this.pokemonSpeciesDetails?.id) {
          this.fetchAdjacentPokemon(this.pokemonSpeciesDetails.id);
        } else {
          this.isAdjacentLoading = false;
        }
      },
      error: () => this.router.navigate(['/'])
    });
  }

  fetchPokemonDetailsByName(name: string) {
    this.pokemonService.getPokemonDetails(undefined, name).subscribe({
      next: (response) => {
        this.pokemonSpeciesDetails = response.pokemon_v2_pokemonspecies[0];
        this.selectedPokemonImage = this.pokemonUtils.getPokemonOfficialImage(
          this.pokemonSpeciesDetails?.pokemon_v2_pokemons?.[0]
        );
        this.isMainLoading = false;

        if (this.pokemonSpeciesDetails?.id) {
          this.fetchAdjacentPokemon(this.pokemonSpeciesDetails.id);
        } else {
          this.isAdjacentLoading = false;
        }
      },
      error: () => this.router.navigate(['/'])
    });
  }

  private fetchAdjacentPokemon(currentId: number) {
    const previous$ = currentId > 1 
      ? this.pokemonService.getPokemonSpeciesById(currentId - 1).pipe(
          catchError(err => {
            console.error("Error fetching previous Pokémon:", err);
            return of(null);
          })
        )
      : of(null);

    const next$ = this.pokemonService.getPokemonSpeciesById(currentId + 1).pipe(
        catchError(err => {
          console.error("Error fetching next Pokémon:", err);
          return of(null);
        })
      );

    forkJoin([previous$, next$]).subscribe(([prevResponse, nextResponse]) => {
      this.previousPokemonSpecies = prevResponse ? prevResponse.pokemon_v2_pokemonspecies[0] : undefined;
      this.nextPokemonSpecies = nextResponse ? nextResponse.pokemon_v2_pokemonspecies[0] : undefined;
      this.isAdjacentLoading = false;
    });
  }
}
