import { Name } from "./species-name.model";

export interface EggGroup {
    id: number;
    name: string;
    pokemon_v2_egggroupnames: Name[];
}

export interface PokemonEggGroups {
    egg_group_id: number;
    id: number;
    pokemon_v2_egggroup: EggGroup;
}
