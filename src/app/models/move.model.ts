import { Name } from "./species-name.model";

export interface Move {
    name: string;
    id: number;
    pokemon_v2_movenames: Name[];
}
