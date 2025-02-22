import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { PokemonSpecies } from '../../../models/pokemon-species.model';
import { PokemonUtilsService } from '../../../utils/pokemon-utils';
import { PokemonBgSvgComponent } from '../../shared/pokemon-bg-svg/pokemon-bg-svg.component';
import { CommonModule } from '@angular/common';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'app-pokemon-navigator',
  standalone: true,
  templateUrl: './pokemon-navigator.component.html',
  styleUrls: ["./pokemon-navigator.component.css"],
  imports: [PokemonBgSvgComponent, CommonModule, MatIcon],
})
export class PokemonNavigatorComponent {
  @Input() pokemon!: PokemonSpecies;

  @Input() facing: 'left' | 'right' = 'right';

  constructor(
    private router: Router,
    private pokemonUtils: PokemonUtilsService
  ) {}

  get pokemonImage(): string {
    return this.pokemonUtils.getPokemonOfficialImage(
      this.pokemon?.pokemon_v2_pokemons?.[0]
    );
  }

  getPokemonName(): string {
    return this.pokemonUtils.getPokemonSpeciesNameByLanguage(this.pokemon);
  }

  navigateToDetails(): void {
    this.router.navigate(['/pokemon', this.getPokemonName()]);
  }
}
