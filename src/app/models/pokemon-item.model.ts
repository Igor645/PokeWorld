import { Item } from "./item.model";
import { Version } from "./version.model";

export interface PokemonItem {
    id: number;
    pokemon_v2_item: Item;
    rarity: number;
    pokemon_v2_version: Version;
}
