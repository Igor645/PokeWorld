import { Name } from "./name.model";

export interface PokemonHabitat {
    id: number;
    name: string;
    pokemonhabitatnames: Name[];
}
