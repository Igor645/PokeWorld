import { Name } from "./name.model";

export interface Generation {
  id: number;
  name: string;
  generationnames: Name[];
}
