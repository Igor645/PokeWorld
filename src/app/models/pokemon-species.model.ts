import { Aggregate } from './aggregate.model';
import { EvolutionChain } from './evolution-chain.model';
import { FlavorText } from './flavor-text.model';
import { Generation } from './generation.model';
import { GrowthRate } from './growthrate.model';
import { Name } from './species-name.model';
import { Pokemon } from './pokemon.model';
import { PokemonColor } from './pokemon-color.model';
import { PokemonEggGroups } from './egggroup';
import { PokemonHabitat } from './pokemon-habitat.model';
import { PokemonShape } from './pokemon-shape.model';
import { PokemonSprites } from './sprite.model';

export interface PokemonSpecies {
  id: number;
  name: string;
  is_baby: boolean;
  is_legendary: boolean;
  is_mythical: boolean;
  evolution_chain_id: number;
  base_happiness: number;
  capture_rate: number;
  gender_rate: number | null;
  hatch_counter: number;
  evolves_from_species_id: number | null;
  pokemons: Pokemon[];
  pokemonspeciesnames: Name[];
  generation: Generation;
  pokemonsprites?: PokemonSprites;
  pokemonspeciesflavortexts: FlavorText[];
  pokemoncolor: PokemonColor;
  pokemonshape: PokemonShape;
  evolutionchain: EvolutionChain;
  pokemonegggroups: PokemonEggGroups[];
  growthrate: GrowthRate;
  pokemonhabitat: PokemonHabitat;
  isFound: boolean;
  pokemon_v2_pokemons: Pokemon[];
  pokemon_v2_pokemonspeciesnames: Name[];
  pokemon_v2_generation: Generation;
  pokemon_v2_pokemonsprites?: PokemonSprites;
  pokemon_v2_pokemonspeciesflavortexts: FlavorText[];
  pokemon_v2_pokemoncolor: PokemonColor;
  pokemon_v2_pokemonshape: PokemonShape;
}

export interface PokemonSpeciesResponse {
  pokemonspecies: PokemonSpecies[];
  pokemonspecies_aggregate: { aggregate: Aggregate };
}
