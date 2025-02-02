import { PokemonSpecies } from "./pokemon-species.model";

export interface SpeciesRow {
  rowId: number;
  pokemon_species: PokemonSpecies[];
}
