import { Name } from "./species-name.model";

export interface EvolutionTrigger {
    name: string;
    id: number;
    evolutiontriggernames: Name[];
}
