import { Name } from "./species-name.model";

export interface Region {
  id: number;
  name: string;
  pokemon_v2_regionnames: Name[];
}