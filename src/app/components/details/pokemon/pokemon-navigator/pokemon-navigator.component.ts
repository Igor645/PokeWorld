import { Component, Input, OnInit, Optional, Self } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { PokemonBgSvgComponent } from '../../../shared/pokemon-bg-svg/pokemon-bg-svg.component';
import { PokemonSpecies } from '../../../../models/pokemon-species.model';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { InteractiveHostDirective } from '../../../shared/directives/interactive-host.directive';

@Component({
  selector: 'app-pokemon-navigator',
  standalone: true,
  templateUrl: './pokemon-navigator.component.html',
  styleUrls: ['./pokemon-navigator.component.css'],
  imports: [PokemonBgSvgComponent, CommonModule, MatIcon],
  hostDirectives: [InteractiveHostDirective]
})
export class PokemonNavigatorComponent implements OnInit {
  @Input() pokemon!: PokemonSpecies;
  @Input() facing: 'left' | 'right' = 'right';

  constructor(
    private pokemonUtils: PokemonUtilsService,
    @Self() @Optional() private interactiveHost?: InteractiveHostDirective
  ) { }

  ngOnInit(): void {
    if (this.interactiveHost && this.pokemon) {
      const name = this.getPokemonName();
      this.interactiveHost.href = ['/pokemon', name];
    }
  }

  get pokemonImage(): string {
    return this.pokemonUtils.getPokemonOfficialImage(
      this.pokemon?.pokemon_v2_pokemons?.[0]
    );
  }

  getPokemonName(): string {
    return this.pokemonUtils.getLocalizedNameFromEntity(this.pokemon, "pokemon_v2_pokemonspeciesnames");
  }
}
