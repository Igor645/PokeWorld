import { Aggregate } from "./aggregate.model";
import { Name } from "./species-name.model";

export interface TypeEfficacies {
  damage_factor: number;
  damage_type_id: number;
  target_type_id: number;
  TypeByTargetTypeId: PokemonType;
}

export interface PokemonType {
  id: number;
  name: string;
  typenames: Name[];
  typeefficacies: TypeEfficacies[];
}

export interface PokemonTypeWrapper {
  type: PokemonType;
}

export interface PokemonTypeResponse {
  type: PokemonType[];
  type_aggregate: { aggregate: Aggregate };
}
