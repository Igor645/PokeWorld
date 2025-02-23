import { Name } from "./species-name.model";

export interface PokemonType {
  id: number;
  name: string;
  pokemon_v2_typenames: Name[];
}

export interface PokemonTypeWrapper {
    pokemon_v2_type: PokemonType;
}
