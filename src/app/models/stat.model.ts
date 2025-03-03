import { Name } from "./species-name.model";

export interface PokemonStat {
  base_stat: number;
  effort: number;
  pokemon_v2_stat: Stat;
}

export interface Stat {
  id: number;
  name: string;
  pokemon_v2_statnames: Name[];
}
