import { Aggregate } from "./aggregate.model";
import { Region } from "./region.model";
import { Name } from "./species-name.model";

export interface Generation {
  id: number;
  name: string;
  pokemon_v2_generationnames: Name[];
  pokemon_v2_region: Region;
}

export interface GenerationResponse {
  pokemon_v2_generation: Generation[];
  pokemon_v2_generation_aggregate: { aggregate: Aggregate };
}
  