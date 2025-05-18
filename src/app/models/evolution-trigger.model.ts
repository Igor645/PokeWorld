import { Name } from "./species-name.model";

export interface EvolutionTrigger {
    name: string;
    id: number;
    pokemon_v2_evolutiontriggernames: Name[];
}
