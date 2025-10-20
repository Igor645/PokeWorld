import { Aggregate } from "./aggregate.model";
import { Name } from "./species-name.model";
import { Region } from "./region.model";

export interface Generation {
  id: number;
  name: string;
  generationnames: Name[];
  region: Region;
}

export interface GenerationResponse {
  generation: Generation[];
  generation_aggregate: { aggregate: Aggregate };
}
