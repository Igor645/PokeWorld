import { Aggregate } from "./aggregate.model";
import { EvolutionTrigger } from "./evolution-trigger.model";
import { Gender } from "./gender.model";
import { Item } from "./item.model";
import { Location } from "./location.model";
import { Move } from "./move.model";
import { Name } from "./species-name.model";
import { PokemonSpecies } from "./pokemon-species.model";
import { PokemonType } from "./pokemon-type.model";

export interface PokemonEvolution {
  id: number;
  time_of_day: string;
  evolved_species_id: number;
  trade_species_id: number;
  turn_upside_down: boolean;
  relative_physical_stats: number;
  known_move_id: number;
  known_move_type_id: number;
  location_id: number;
  min_affection: number;
  min_beauty: number;
  min_happiness: number;
  min_level: number;
  needs_overworld_rain: boolean;
  party_species_id: number;
  party_type_id: number;
  gender_id: number;
  held_item_id: number;
  evolution_trigger_id: number;
  evolution_item_id: number;
  ItemByHeldItemId: Item;
  item: Item;
  evolutiontrigger: EvolutionTrigger;
  gender: Gender;
  PokemonspecyByPartySpeciesId: PokemonSpecies;
  PokemonspecyByTradeSpeciesId: PokemonSpecies;
  TypeByPartyTypeId: PokemonType;
  location: Location;
  move: Move;
  type: PokemonType;
}

export interface PokemonEvolutionResponse {
  pokemonevolution: PokemonEvolution[];
  pokemonevolution_aggregate: { aggregate: Aggregate };
}
