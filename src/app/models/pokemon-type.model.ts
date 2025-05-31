import { Aggregate } from "./aggregate.model";
import { Name } from "./species-name.model";

export interface TypeEfficacies {
  damage_factor: number;
  damage_type_id: number;
  target_type_id: number;
  pokemonV2TypeByTargetTypeId: PokemonType;
}

export interface PokemonType {
  id: number;
  name: string;
  pokemon_v2_typenames: Name[];
  pokemon_v2_typeefficacies: TypeEfficacies[];
}

export interface PokemonTypeWrapper {
  pokemon_v2_type: PokemonType;
}

export interface PokemonTypeResponse {
  pokemon_v2_type: PokemonType[];
  pokemon_v2_type_aggregate: { aggregate: Aggregate };
}
