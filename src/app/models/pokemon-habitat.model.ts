import { Name } from "./species-name.model";

export interface PokemonHabitat {
    id: number;
    name: string;
    pokemonhabitatnames: Name[];
}
