import { Name } from "./species-name.model";

export interface PokemonStat {
  base_stat: number;
  effort: number;
  stat: Stat;
}

export interface Stat {
  id: number;
  name: string;
  statnames: Name[];
}
