import { Name } from "./species-name.model";

export interface PokemonShape {
    id: number;
    name: string;
    pokemon_v2_pokemonshapenames: Name[];
}