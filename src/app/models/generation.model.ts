import { Name } from "./species-name.model";

export interface Generation {
  id: number;
  name: string;
  pokemon_v2_generationnames: Name[];
}
