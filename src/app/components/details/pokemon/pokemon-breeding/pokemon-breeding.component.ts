import { Component, HostBinding, Input } from '@angular/core';

import { CommonModule } from '@angular/common';
import { EggGroup } from '../../../../models/egggroup';
import { ExpandableSectionComponent } from '../../../shared/expandable-section/expandable-section.component';
import { GrowthRate } from '../../../../models/growthrate.model';
import { Item } from '../../../../models/item.model';
import { Name } from '../../../../models/name.model';
import { Pokemon } from '../../../../models/pokemon.model';
import { PokemonHabitat } from '../../../../models/pokemon-habitat.model';
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

  isExpanded = true;

  @HostBinding('class.expanded')
  get hostExpanded() { return this.isExpanded; }

  constructor(private pokemonUtils: PokemonUtilsService) { }

  getGenderDisplay(): { male: number; female: number; genderless: boolean } {
    const species = this.pokemonSpecies;

    const genderless = { male: 0, female: 0, genderless: true };

    if (!species || species.gender_rate === null || species.gender_rate === undefined) {
      return genderless;
    }

    if (species.gender_rate === -1) {
      return genderless;
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

  getItemNameByLanguage(item: Item | undefined): string {
    return this.pokemonUtils.getLocalizedNameFromEntity(item, "itemnames");
  }

  getEggGroupNameByLanguage(eggGroup: EggGroup | undefined): string {
    return this.pokemonUtils.getLocalizedNameFromEntity(eggGroup, "egggroupnames");
  }

  getHabitatNameByLanguage(habitat: PokemonHabitat | undefined): string {
    return this.pokemonUtils.getLocalizedNameFromEntity(habitat, "pokemonhabitatnames");
  }

  getGrowthRateDescriptions(growthRate: GrowthRate | undefined): string {
    return this.pokemonUtils.getLocalizedNameFromEntity(growthRate, "growthratedescriptions");
  }

  getBabyTriggerItem(): Item | undefined {
    return this.pokemonSpecies?.evolutionchain?.item
  }
}
