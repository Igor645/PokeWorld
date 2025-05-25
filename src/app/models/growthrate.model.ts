import { Description } from "./description.model";

export interface GrowthRate {
    id: number;
    name: string;
    formula: string;
    pokemon_v2_growthratedescriptions: Description[];
}
