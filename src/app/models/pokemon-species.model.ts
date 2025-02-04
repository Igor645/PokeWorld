import { Pokemon } from './pokemon.model';
import { Aggregate } from './aggregate.model';
import { Name } from './species-name.model';
import { Generation } from './generation.model';
import { PokemonSprites } from './sprite.model';
import { FlavorText } from './flavor-text.model';

export interface PokemonSpecies {
  id: number;
  name: string;
  pokemon_v2_pokemons: Pokemon[];
  pokemon_v2_pokemonspeciesnames: Name[];
  pokemon_v2_generation: Generation;
  pokemon_v2_pokemonsprites?: PokemonSprites;
  pokemon_v2_pokemonspeciesflavortexts: FlavorText[];
}

export interface PokemonSpeciesResponse {
  pokemon_v2_pokemonspecies: PokemonSpecies[];
  pokemon_v2_pokemonspecies_aggregate: { aggregate: Aggregate };
}
