import { Component, Input, OnChanges } from '@angular/core';
import { EvolutionChain } from '../../../../models/evolution-chain.model';
import { PokemonEvolution } from '../../../../models/pokemon-evolution.model';
import { PokemonCardComponent } from '../../../shared/pokemon-card/pokemon-card.component';
import { CommonModule } from '@angular/common';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { EvolutionTrigger } from '../../../../models/evolution-trigger.model';
import { PokemonSpecies } from '../../../../models/pokemon-species.model';

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

  constructor(public pokemonUtils: PokemonUtilsService) {}

  ngOnChanges(): void {
    if (this.evolutionChain) {
      this.evolutionPaths = this.buildFullEvolutionPaths();
    }
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

  getPokemonEvolution(id: number): PokemonEvolution | undefined {
    return this.pokemonEvolutions.find(
      evolution => evolution?.evolved_species_id === id
    );
  }

  getEvolutionTriggerName(evolutionTrigger: EvolutionTrigger): string {
    return this.pokemonUtils.getEvolutionTriggerByLanguage(evolutionTrigger);
  }
}
