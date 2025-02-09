import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PokemonService } from '../../../services/pokemon.service';
import { PokemonSpecies } from '../../../models/pokemon-species.model';
import { Version } from '../../../models/version.model';
import { CommonModule } from '@angular/common';
import { PokemonUtilsService } from '../../../utils/pokemon-utils';
import { PokemonBgSvgComponent } from '../../shared/pokemon-bg-svg/pokemon-bg-svg.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { DexEntryComponent } from '../dex-entry/dex-entry.component';

@Component({
  selector: 'app-pokemon-details',
  standalone: true,
  imports: [CommonModule, PokemonBgSvgComponent, LoadingSpinnerComponent, DexEntryComponent],
  templateUrl: './pokemon-details.component.html',
  styleUrls: ['./pokemon-details.component.css']
})
export class PokemonDetailsComponent implements OnInit {
  pokemonSpeciesDetails?: PokemonSpecies;
  selectedPokemonImage?: string;

  versions: Version[] = [];
  selectedVersion: Version | null = null;

  private selectedLanguageId$ = new BehaviorSubject<number>(9); // Default: English

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pokemonService: PokemonService,
    public pokemonUtils: PokemonUtilsService
  ) {}

  ngOnInit() {
    const speciesIdOrName = this.route.snapshot.paramMap.get('speciesIdOrName');

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
  }

  fetchPokemonDetails(id: number) {
    this.pokemonService.getPokemonDetails(id, undefined).subscribe({
      next: (response) => {
        this.pokemonSpeciesDetails = response.pokemon_v2_pokemonspecies[0];
        this.selectedPokemonImage = this.pokemonUtils.getPokemonOfficialImage(
          this.pokemonSpeciesDetails?.pokemon_v2_pokemons?.[0]
        );
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
      },
      error: () => this.router.navigate(['/'])
    });
  }
}
