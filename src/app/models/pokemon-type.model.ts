import { Aggregate } from "./aggregate.model";
import { Type } from "./type.model";

export interface PokemonType {
  type: Type;
}

export interface PokemonTypeResponse {
  type: Type[];
  type_aggregate: { aggregate: Aggregate };
}

export const EMPTY_POKEMON_TYPE_RESPONSE: PokemonTypeResponse = {
  type: [],
  type_aggregate: { aggregate: { count: 0 } },
};

