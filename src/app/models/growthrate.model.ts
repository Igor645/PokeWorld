import { Name } from "./name.model";

export interface GrowthRate {
    id: number;
    name: string;
    formula: string;
    growthratedescriptions: Name[];
}
