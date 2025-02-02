export interface PokemonStat {
  base_stat: number;
  effort: number;
  pokemon_v2_stat: Stat;
}

export interface Stat {
  id: number;
  name: string;
}
