import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PokemonService } from '../../services/pokemon.service';
import { PokemonSpecies } from '../../models/pokemon-species.model';
import { CommonModule } from '@angular/common';
import { getPokemonOfficialImage, getPokemonSpeciesNameByLanguage, getPokemonSpeciesDexEntryByLanguageAndVersion } from '../../utils/pokemon-utils';

@Component({
  selector: 'app-pokemon-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pokemon-details.component.html',
  styleUrls: ['./pokemon-details.component.css']
})
export class PokemonDetailsComponent implements OnInit {
  pokemonSpeciesDetails?: PokemonSpecies;
  selectedPokemonImage?: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pokemonService: PokemonService
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
        this.selectedPokemonImage = getPokemonOfficialImage(this.pokemonSpeciesDetails?.pokemon_v2_pokemons?.[0]);
      },
      error: () => this.router.navigate(['/'])
    });
  }

  fetchPokemonDetailsByName(name: string) {
    this.pokemonService.getPokemonDetails(undefined, name).subscribe({
      next: (response) => {
        this.pokemonSpeciesDetails = response.pokemon_v2_pokemonspecies[0];
        this.selectedPokemonImage = getPokemonOfficialImage(this.pokemonSpeciesDetails?.pokemon_v2_pokemons?.[0]);
      },
      error: () => this.router.navigate(['/'])
    });
  }

  getPokemonSpeciesName(): string {
    return getPokemonSpeciesNameByLanguage(this.pokemonSpeciesDetails, 'en');
  }

  getPokemonDexEntry(): string {
    return getPokemonSpeciesDexEntryByLanguageAndVersion(this.pokemonSpeciesDetails, 'en', null);
  }
}
