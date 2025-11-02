import { FlavorText } from "./flavor-text.model";
import { Generation } from "./generation.model";
import { Machine } from "./machine.model";
import { MoveDamageClass } from "./move-damage-class.model";
import { Name } from "./name.model";
import { Type } from "./type.model";

export interface Move {
    id: number;
    name: string;
    accuracy: number;
    power: number;
    pp: number;
    priority: number;
    type: Type;
    machines: Machine[];
    movedamageclass: MoveDamageClass;
    moveflavortexts: FlavorText[];
    movenames: Name[];
    generation: Generation;
}
