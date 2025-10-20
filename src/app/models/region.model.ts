import { Name } from "./species-name.model";

export interface Region {
  id: number;
  name: string;
  regionnames: Name[];
}
