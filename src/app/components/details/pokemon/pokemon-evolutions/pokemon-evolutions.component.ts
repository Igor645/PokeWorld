import { Component, HostListener, Input, OnChanges } from '@angular/core';
import { animate, state, style, transition, trigger } from '@angular/animations';

import { CommonModule } from '@angular/common';
import { EvolutionChain } from '../../../../models/evolution-chain.model';
import { EvolutionTrigger } from '../../../../models/evolution-trigger.model';
import { PokemonCardComponent } from '../../../shared/pokemon-card/pokemon-card.component';
import { PokemonEvolution } from '../../../../models/pokemon-evolution.model';
import { PokemonSpecies } from '../../../../models/pokemon-species.model';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { get } from 'node:http';

interface EvolutionCondition {
  text: string;
  spriteUrl?: string;
  suffix?: string;
}

@Component({
  selector: 'app-pokemon-evolutions',
  imports: [
    CommonModule,
    PokemonCardComponent
  ],
  templateUrl: './pokemon-evolutions.component.html',
  styleUrl: './pokemon-evolutions.component.css',
  animations: [
    trigger('expandCollapse', [
      state('expanded', style({
        height: '*',
        opacity: 1,
        paddingTop: '*',
        paddingBottom: '*',
        marginTop: '*',
        marginBottom: '*',
        overflow: 'hidden'
      })),
      state('collapsed', style({
        height: '0px',
        opacity: 0,
        paddingTop: '0',
        paddingBottom: '0',
        marginTop: '0',
        marginBottom: '0',
        overflow: 'hidden'
      })),
      transition('expanded <=> collapsed', animate('300ms ease-in-out')),
    ])
  ]
})

export class PokemonEvolutionsComponent implements OnChanges {
  @Input() evolutionChain: EvolutionChain | undefined = undefined;
  @Input() pokemonEvolutions: PokemonEvolution[] = [];

  evolutionPaths: (PokemonSpecies | null)[][] = [];
  isExpanded = true;
  isMobile = false;

  constructor(public pokemonUtils: PokemonUtilsService) { }

  ngOnChanges(): void {
    if (this.evolutionChain) {
      this.evolutionPaths = this.buildFullEvolutionPaths();
    }
  }


  @HostListener('window:resize')
  onResize() {
    this.isMobile = window.innerWidth <= 768;
  }

  ngOnInit() {
    this.onResize();
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
    return this.pokemonEvolutions.filter(
      evolution => evolution?.evolved_species_id === id
    );
  }

  getEvolutionTriggerName(evolutionTrigger: EvolutionTrigger): string {
    return this.pokemonUtils.getNameByLanguage(evolutionTrigger.pokemon_v2_evolutiontriggernames);
  }

  getEvolutionConditions(evo: PokemonEvolution): EvolutionCondition[] {
    const conditions: EvolutionCondition[] = [];

    if (typeof evo.min_level === 'number') {
      conditions.push({ text: 'Level', suffix: `${evo.min_level}` });
    }

    if (evo.time_of_day) {
      conditions.push({ text: 'during the', suffix: evo.time_of_day });
    }

    if (evo.min_happiness != null) {
      conditions.push({ text: 'with high friendship' });
    }

    if (evo.min_beauty != null) {
      conditions.push({ text: 'with high beauty' });
    }

    if (evo.min_affection != null) {
      conditions.push({ text: 'with high affection' });
    }

    if (evo.pokemon_v2_item) {
      const item = evo.pokemon_v2_item;
      const name = this.pokemonUtils.getNameByLanguage(item.pokemon_v2_itemnames);
      const sprite = item.pokemon_v2_itemsprites?.[0]?.sprites?.default;
      conditions.push({
        text: 'use',
        suffix: name,
        spriteUrl: sprite
      });
    }

    if (evo.pokemonV2ItemByHeldItemId) {
      const item = evo.pokemonV2ItemByHeldItemId;
      const name = this.pokemonUtils.getNameByLanguage(item.pokemon_v2_itemnames);
      const sprite = item.pokemon_v2_itemsprites?.[0]?.sprites?.default;
      conditions.push({
        text: 'hold',
        suffix: name,
        spriteUrl: sprite
      });
    }

    if (evo.pokemon_v2_gender?.name) {
      conditions.push({ text: 'must be', suffix: evo.pokemon_v2_gender.name });
    }

    if (evo.pokemon_v2_location) {
      const name = this.pokemonUtils.getNameByLanguage(evo.pokemon_v2_location.pokemon_v2_locationnames);
      conditions.push({ text: 'at', suffix: name });
    }

    if (evo.pokemon_v2_move) {
      const name = this.pokemonUtils.getNameByLanguage(evo.pokemon_v2_move.pokemon_v2_movenames);
      conditions.push({ text: 'knowing the move', suffix: name });
    }

    if (evo.pokemon_v2_type) {
      const name = this.pokemonUtils.getNameByLanguage(evo.pokemon_v2_type.pokemon_v2_typenames);
      conditions.push({ text: 'knowing a', suffix: `${name}-type move` });
    }

    if (evo.needs_overworld_rain) {
      conditions.push({ text: 'while raining' });
    }

    if (evo.turn_upside_down) {
      conditions.push({ text: 'while turning the device upside down' });
    }

    if (evo.pokemonV2PokemonspecyByPartySpeciesId) {
      const name = this.pokemonUtils.getNameByLanguage(evo.pokemonV2PokemonspecyByPartySpeciesId.pokemon_v2_pokemonspeciesnames);
      conditions.push({ text: 'with', suffix: `${name} in party` });
    }

    if (evo.pokemonV2TypeByPartyTypeId) {
      const name = this.pokemonUtils.getNameByLanguage(evo.pokemonV2TypeByPartyTypeId.pokemon_v2_typenames);
      conditions.push({ text: 'with a', suffix: `${name}-type Pokémon in party` });
    }

    if (evo.pokemonV2PokemonspecyByTradeSpeciesId) {
      const name = this.pokemonUtils.getNameByLanguage(evo.pokemonV2PokemonspecyByTradeSpeciesId.pokemon_v2_pokemonspeciesnames);
      conditions.push({ text: 'trade with', suffix: name });
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
        conditions.push({ text: `when ${statText}` });
      }
    }

    if (evo.pokemon_v2_evolutiontrigger) {
      const name = this.getEvolutionTriggerName(evo.pokemon_v2_evolutiontrigger);
      if (!conditions.some(c => c.text === name || c.suffix === name)) {
        conditions.push({ text: name });
      }
    }

    if (conditions.length === 0) {
      conditions.push({ text: 'No evolutions' });
    }

    return conditions;
  }


  isMultiStage(path: (PokemonSpecies | null)[]): boolean {
    return path.filter(p => p !== null).length > 1;
  }
}
