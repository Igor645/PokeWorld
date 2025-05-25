import { Name } from "./species-name.model";

export interface PokemonHabitat {
    id: number;
    name: string;
    pokemon_v2_pokemonhabitatnames: Name[];
}
