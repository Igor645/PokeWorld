import { Item } from "./item.model";
import { Version } from "./version.model";

export interface PokemonItem {
    id: number;
    item: Item;
    rarity: number;
    version: Version;
}
