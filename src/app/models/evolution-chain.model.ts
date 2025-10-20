import { Item } from "./item.model";
import { PokemonSpecies } from "./pokemon-species.model";

export interface EvolutionChain {
    baby_trigger_item_id: number | null;
    pokemonspecies: PokemonSpecies[];
    item: Item;
}
