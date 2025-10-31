import { Name } from "./name.model";

export interface EggGroup {
    id: number;
    name: string;
    egggroupnames: Name[];
}

export interface PokemonEggGroups {
    egg_group_id: number;
    id: number;
    egggroup: EggGroup;
}
