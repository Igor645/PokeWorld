import { Name } from "./species-name.model";

export interface GrowthRate {
    id: number;
    name: string;
    formula: string;
    pokemon_v2_growthratedescriptions: Name[];
}
