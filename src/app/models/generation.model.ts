import { Name } from "./species-name.model";

export interface Generation {
  id: number;
  name: string;
  generationnames: Name[];
}
