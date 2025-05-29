import { Component, HostListener, Input, OnChanges } from '@angular/core';
import { EvolutionCondition, EvolutionConditionDisplayComponent } from './evolution-condition-display/evolution-condition-display.component';
import { animate, state, style, transition, trigger } from '@angular/animations';

import { CommonModule } from '@angular/common';
import { EvolutionChain } from '../../../../models/evolution-chain.model';
import { EvolutionTrigger } from '../../../../models/evolution-trigger.model';
import { ExpandableSectionComponent } from '../../../shared/expandable-section/expandable-section.component';
import { PokemonCardComponent } from '../../../shared/pokemon-card/pokemon-card.component';
import { PokemonEvolution } from '../../../../models/pokemon-evolution.model';
import { PokemonSpecies } from '../../../../models/pokemon-species.model';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { RouterModule } from '@angular/router';
import { get } from 'node:http';

@Component({
  selector: 'app-pokemon-evolutions',
  imports: [
    CommonModule,
    PokemonCardComponent,
    ExpandableSectionComponent,
    EvolutionConditionDisplayComponent,
    RouterModule
  ],
  templateUrl: './pokemon-evolutions.component.html',
  styleUrl: './pokemon-evolutions.component.css'
})

export class PokemonEvolutionsComponent implements OnChanges {
  @Input() evolutionChain: EvolutionChain | undefined = undefined;
  @Input() pokemonEvolutions: PokemonEvolution[] = [];

  evolutionPaths: (PokemonSpecies | null)[][] = [];
  isExpanded = true;

  constructor(public pokemonUtils: PokemonUtilsService) { }

  ngOnChanges(): void {
    if (this.evolutionChain) {
      this.evolutionPaths = this.buildFullEvolutionPaths();
    }
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
  }

  buildFullEvolutionPaths(): PokemonSpecies[][] {
    const speciesMap = new Map<number, PokemonSpecies>();
    if (!this.evolutionChain) return [];

    for (const species of this.evolutionChain.pokemon_v2_pokemonspecies) {
      speciesMap.set(species.id, species);
    }

    const paths: PokemonSpecies[][] = [];

    for (const species of speciesMap.values()) {
      const hasChildren = Array.from(speciesMap.values()).some(
        s => s.evolves_from_species_id === species.id
      );
      if (hasChildren) continue;

      const path: PokemonSpecies[] = [];
      let current: PokemonSpecies | undefined = species;

      while (current) {
        path.unshift(current);
        current = current.evolves_from_species_id
          ? speciesMap.get(current.evolves_from_species_id)
          : undefined;
      }

      paths.push(path);
    }

    return paths;
  }

  getPokemonEvolution(id: number): PokemonEvolution[] | undefined {
    var evos = this.pokemonEvolutions.filter(
      evolution => evolution?.evolved_species_id === id
    );

    return evos.length > 0 ? evos : undefined;
  }

  getEvolutionTriggerName(evolutionTrigger: EvolutionTrigger): string {
    return this.pokemonUtils.getLocalizedNameFromEntity(evolutionTrigger, "pokemon_v2_evolutiontriggernames");
  }

  getEvolutionConditions(evo: PokemonEvolution): EvolutionCondition[] {
    const conditions: EvolutionCondition[] = [];

    if (typeof evo.min_level === 'number') {
      conditions.push({ prefix: 'Level ', entity: `${evo.min_level}` });
    }

    if (evo.time_of_day) {
      conditions.push({ prefix: 'during the ', entity: evo.time_of_day });
    }

    if (evo.min_happiness != null) {
      conditions.push({ prefix: 'with high friendship' });
    }

    if (evo.min_beauty != null) {
      conditions.push({ prefix: 'with high beauty' });
    }

    if (evo.min_affection != null) {
      conditions.push({ prefix: 'with high affection' });
    }

    if (evo.pokemon_v2_item) {
      const item = evo.pokemon_v2_item;
      const name = this.pokemonUtils.getLocalizedNameFromEntity(item, "pokemon_v2_itemnames");
      const sprite = item.pokemon_v2_itemsprites?.[0]?.sprites?.default;
      conditions.push({
        prefix: 'use',
        entity: name,
        href: `/item/${name}`,
        spriteUrl: sprite
      });
    }

    if (evo.pokemonV2ItemByHeldItemId) {
      const item = evo.pokemonV2ItemByHeldItemId;
      const name = this.pokemonUtils.getLocalizedNameFromEntity(item, "pokemon_v2_itemnames");
      const sprite = item.pokemon_v2_itemsprites?.[0]?.sprites?.default;
      conditions.push({
        prefix: 'hold',
        entity: name,
        href: `/item/${name}`,
        spriteUrl: sprite
      });
    }

    if (evo.pokemon_v2_gender?.name) {
      const isFemale = evo.pokemon_v2_gender.name.toLowerCase() === 'female';
      const spriteUrl = isFemale ? '/images/female.png' : '/images/male.png';

      conditions.push({
        prefix: 'must be',
        spriteUrl
      });
    }

    if (evo.pokemon_v2_location) {
      const name = this.pokemonUtils.getLocalizedNameFromEntity(evo.pokemon_v2_location, "pokemon_v2_locationnames");
      conditions.push({
        prefix: 'at ',
        entity: name,
        href: `/location/${name}`
      });
    }

    if (evo.pokemon_v2_move) {
      const name = this.pokemonUtils.getLocalizedNameFromEntity(evo.pokemon_v2_move, "pokemon_v2_movenames");
      conditions.push({
        prefix: 'knowing the move ',
        entity: name,
        href: `/move/${name}`
      });
    }

    if (evo.pokemon_v2_type) {
      const name = this.pokemonUtils.getLocalizedNameFromEntity(evo.pokemon_v2_type, "pokemon_v2_typenames");
      conditions.push({
        prefix: 'knowing a ',
        entity: name,
        suffix: '-type move',
        href: `/type/${name}`
      });
    }

    if (evo.needs_overworld_rain) {
      conditions.push({ prefix: 'while raining' });
    }

    if (evo.turn_upside_down) {
      conditions.push({ prefix: 'while turning the device upside down' });
    }

    if (evo.pokemonV2PokemonspecyByPartySpeciesId) {
      const name = this.pokemonUtils.getLocalizedNameFromEntity(evo.pokemonV2PokemonspecyByPartySpeciesId, "pokemon_v2_pokemonspeciesnames");
      conditions.push({
        prefix: 'with ',
        entity: name,
        suffix: ' in party',
        href: `/pokemon/${name}`
      });
    }

    if (evo.pokemonV2TypeByPartyTypeId) {
      const name = this.pokemonUtils.getLocalizedNameFromEntity(evo.pokemonV2TypeByPartyTypeId, "pokemon_v2_typenames");
      conditions.push({
        prefix: 'with a ',
        entity: name,
        suffix: '-type Pokémon in party',
        href: `/type/${name}`
      });
    }

    if (evo.pokemonV2PokemonspecyByTradeSpeciesId) {
      const name = this.pokemonUtils.getLocalizedNameFromEntity(evo.pokemonV2PokemonspecyByTradeSpeciesId, "pokemon_v2_pokemonspeciesnames");
      conditions.push({
        prefix: 'trade with ',
        entity: name,
        href: `/pokemon/${name}`
      });
    }

    if (typeof evo.relative_physical_stats === 'number') {
      let statText = '';
      switch (evo.relative_physical_stats) {
        case 1:
          statText = 'Attack > Defense';
          break;
        case 0:
          statText = 'Attack = Defense';
          break;
        case -1:
          statText = 'Attack < Defense';
          break;
      }
      if (statText) {
        conditions.push({ prefix: `when ${statText}` });
      }
    }

    if (evo.pokemon_v2_evolutiontrigger) {
      const name = this.getEvolutionTriggerName(evo.pokemon_v2_evolutiontrigger);
      if (!conditions.some(c => c.prefix === name || c.entity === name)) {
        conditions.push({ prefix: name });
      }
    }

    if (conditions.length === 0) {
      conditions.push({ prefix: 'No evolutions' });
    }

    return conditions;
  }

  hasConditions(evolutions: PokemonEvolution[]): boolean {
    return evolutions.some(evo => this.getEvolutionConditions(evo)?.length > 0);
  }

  isMultiStage(path: (PokemonSpecies | null)[]): boolean {
    return path.filter(p => p !== null).length > 1;
  }
}
