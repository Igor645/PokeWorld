import { Component, Input, OnChanges } from '@angular/core';
import { EvolutionChain } from '../../../../models/evolution-chain.model';
import { PokemonEvolution } from '../../../../models/pokemon-evolution.model';
import { PokemonCardComponent } from '../../../shared/pokemon-card/pokemon-card.component';
import { CommonModule } from '@angular/common';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { EvolutionTrigger } from '../../../../models/evolution-trigger.model';
import { PokemonSpecies } from '../../../../models/pokemon-species.model';
import { get } from 'node:http';

@Component({
  selector: 'app-pokemon-evolutions',
  imports: [
    CommonModule,
    PokemonCardComponent
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

  buildFullEvolutionPaths(): (PokemonSpecies | null)[][] {
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

    const maxLength = Math.max(...paths.map(path => path.length));

    const paddedPaths = paths.map(path => {
      const padded: (PokemonSpecies | null)[] = [...path];
      while (padded.length < maxLength) {
        padded.push(null);
      }
      return padded;
    });

    return paddedPaths;
  }

  getPokemonEvolution(id: number): PokemonEvolution[] | undefined {
    console.log(this.pokemonEvolutions);
    return this.pokemonEvolutions.filter(
      evolution => evolution?.evolved_species_id === id
    );
  }

  getEvolutionTriggerName(evolutionTrigger: EvolutionTrigger): string {
    return this.pokemonUtils.getNameByLanguage(evolutionTrigger.pokemon_v2_evolutiontriggernames);
  }

  getEvolutionConditions(evo: PokemonEvolution): string[] {
    const conditions: string[] = [];

    if (typeof evo.min_level === 'number') {
      conditions.push(`Level ${evo.min_level}`);
    }

    if (evo.time_of_day) {
      conditions.push(`during the ${evo.time_of_day}`);
    }

    if (evo.min_happiness != null) {
      conditions.push(`with high friendship`);
    }

    if (evo.min_beauty != null) {
      conditions.push(`with high beauty`);
    }

    if (evo.min_affection != null) {
      conditions.push(`with high affection`);
    }

    if (evo.pokemon_v2_item) {
      const name = this.pokemonUtils.getNameByLanguage(evo.pokemon_v2_item?.pokemon_v2_itemnames);
      conditions.push(`${name}`);
    }

    if (evo.pokemonV2ItemByHeldItemId) {
      const name = this.pokemonUtils.getNameByLanguage(evo.pokemonV2ItemByHeldItemId.pokemon_v2_itemnames);
      conditions.push(`hold ${name}`);
    }

    if (evo.pokemon_v2_gender?.name) {
      conditions.push(`must be ${evo.pokemon_v2_gender.name}`);
    }

    if (evo.pokemon_v2_location) {
      const name = this.pokemonUtils.getNameByLanguage(evo.pokemon_v2_location.pokemon_v2_locationnames);
      conditions.push(`at ${name}`);
    }

    if (evo.pokemon_v2_move) {
      const name = this.pokemonUtils.getNameByLanguage(evo.pokemon_v2_move.pokemon_v2_movenames);
      conditions.push(`knowing the move ${name}`);
    }

    if (evo.pokemon_v2_type) {
      const name = this.pokemonUtils.getNameByLanguage(evo.pokemon_v2_type.pokemon_v2_typenames);
      conditions.push(`knowing a ${name}-type move`);
    }

    if (evo.needs_overworld_rain) {
      conditions.push(`while raining`);
    }

    if (evo.turn_upside_down) {
      conditions.push(`while turning the device upside down`);
    }

    if (evo.pokemonV2PokemonspecyByPartySpeciesId) {
      const name = this.pokemonUtils.getNameByLanguage(evo.pokemonV2PokemonspecyByPartySpeciesId.pokemon_v2_pokemonspeciesnames);
      conditions.push(`with ${name} in party`);
    }

    if (evo.pokemonV2TypeByPartyTypeId) {
      const name = this.pokemonUtils.getNameByLanguage(evo.pokemonV2TypeByPartyTypeId.pokemon_v2_typenames);
      conditions.push(`with a ${name}-type Pokémon in party`);
    }

    if (evo.pokemonV2PokemonspecyByTradeSpeciesId) {
      const name = this.pokemonUtils.getNameByLanguage(evo.pokemonV2PokemonspecyByTradeSpeciesId.pokemon_v2_pokemonspeciesnames);
      conditions.push(`trade with ${name}`);
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
        conditions.push(`when ${statText}`);
      }
    }

    if (evo.pokemon_v2_evolutiontrigger) {
      const name = this.getEvolutionTriggerName(evo.pokemon_v2_evolutiontrigger);
      if (!conditions.includes(name)) {
        conditions.push(name);
      }
    }

    return conditions;
  }
}
