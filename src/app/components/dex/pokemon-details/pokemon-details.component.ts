import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PokemonService } from '../../../services/pokemon.service';
import { PokemonSpecies } from '../../../models/pokemon-species.model';
import { CommonModule } from '@angular/common';
import { PokemonUtilsService } from '../../../utils/pokemon-utils';
import { PokemonBgSvgComponent } from '../../shared/pokemon-bg-svg/pokemon-bg-svg.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-pokemon-details',
  standalone: true,
  imports: [CommonModule, PokemonBgSvgComponent, LoadingSpinnerComponent],
  templateUrl: './pokemon-details.component.html',
  styleUrls: ['./pokemon-details.component.css']
})
export class PokemonDetailsComponent implements OnInit {
  pokemonSpeciesDetails?: PokemonSpecies;
  selectedPokemonImage?: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pokemonService: PokemonService,
    private pokemonUtils: PokemonUtilsService
  ) {}

  ngOnInit() {
    const speciesIdOrName = this.route.snapshot.paramMap.get('speciesIdOrName');

    console.log("Route Parameter:", speciesIdOrName);

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
        this.selectedPokemonImage = this.pokemonUtils.getPokemonOfficialImage(this.pokemonSpeciesDetails?.pokemon_v2_pokemons?.[0]);
      },
      error: () => this.router.navigate(['/'])
    });
  }

  fetchPokemonDetailsByName(name: string) {
    this.pokemonService.getPokemonDetails(undefined, name).subscribe({
      next: (response) => {
        this.pokemonSpeciesDetails = response.pokemon_v2_pokemonspecies[0];
        this.selectedPokemonImage = this.pokemonUtils.getPokemonOfficialImage(this.pokemonSpeciesDetails?.pokemon_v2_pokemons?.[0]);
      },
      error: () => this.router.navigate(['/'])
    });
  }

  getPokemonSpeciesName(): string {
    return this.pokemonUtils.getPokemonSpeciesNameByLanguage(this.pokemonSpeciesDetails);
  }

  getPokemonDexEntry(): string {
    return this.pokemonUtils.getPokemonSpeciesDexEntryByVersion(this.pokemonSpeciesDetails, null);
  }
}
