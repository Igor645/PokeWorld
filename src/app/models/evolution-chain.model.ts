import { Item } from "./item.model";
import { PokemonSpecies } from "./pokemon-species.model";

export interface EvolutionChain {
    baby_trigger_item_id: number |null;
    pokemon_v2_pokemonspecies: PokemonSpecies[];
    pokemon_v2_item: Item[];
}
  