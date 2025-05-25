import { Component, Input } from '@angular/core';

import { CommonModule } from '@angular/common';
import { Description } from '../../../../models/description.model';
import { ExpandableSectionComponent } from '../../../shared/expandable-section/expandable-section.component';
import { Name } from '../../../../models/species-name.model';
import { Pokemon } from '../../../../models/pokemon.model';
import { PokemonSpecies } from '../../../../models/pokemon-species.model';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-pokemon-breeding',
  templateUrl: './pokemon-breeding.component.html',
  styleUrls: ['./pokemon-breeding.component.css'],
  imports: [CommonModule, ExpandableSectionComponent, RouterModule],
})
export class PokemonBreedingComponent {
  @Input() pokemonSpecies: PokemonSpecies | undefined;
  @Input() pokemon: Pokemon | undefined;

  constructor(private pokemonUtils: PokemonUtilsService) { }

  getGenderDisplay(): { male: number; female: number; genderless: boolean } {
    const species = this.pokemonSpecies;

    if (!species || species.gender_rate === null || species.gender_rate === undefined) {
      return { male: 0, female: 0, genderless: true };
    }

    if (species.gender_rate === -1) {
      return { male: 0, female: 0, genderless: true };
    }

    const female = (species.gender_rate / 8) * 100;
    const male = 100 - female;

    return {
      male: parseFloat(male.toFixed(1)),
      female: parseFloat(female.toFixed(1)),
      genderless: false,
    };
  }

  getHatchInfo(hatchCounter: number): { cycles: number; steps: number } {
    const STEPS_PER_CYCLE = 255;
    const cycles = hatchCounter;
    const steps = STEPS_PER_CYCLE * (hatchCounter + 1);
    return { cycles, steps };
  }

  getNameByLanguage(names: Name[]): string {
    return this.pokemonUtils.getNameByLanguage(names);
  }

  getDescriptionByLanguage(descriptions: Description[] | undefined): string {
    return this.pokemonUtils.getDescriptionByLanguage(descriptions);
  }
}
