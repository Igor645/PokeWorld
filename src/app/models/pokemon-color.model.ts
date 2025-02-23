import { Name } from "./species-name.model";

export interface PokemonColor {
    id: number;
    name: string;
    pokemon_v2_pokemoncolornames: Name[];
}