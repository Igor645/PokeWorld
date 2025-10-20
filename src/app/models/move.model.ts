import { Name } from "./species-name.model";

export interface Move {
    name: string;
    id: number;
    movenames: Name[];
}
