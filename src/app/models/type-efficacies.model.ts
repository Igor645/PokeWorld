import { Type } from "./type.model";

export interface TypeEfficacies {
    damage_factor: number;
    damage_type_id: number;
    target_type_id: number;
    TypeByTargetTypeId: Type;
}
