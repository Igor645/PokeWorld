import { Name } from "./species-name.model";

export interface Loaction {
    id: number;
    name: string;
    region_id: number;
    pokemon_v2_locationnames: Name[];
}