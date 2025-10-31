import { Name } from "./name.model";
import { TypeEfficacies } from "./type-efficacies.model";

export interface Type {
    id: number;
    name: string;
    typenames: Name[];
    typeefficacies: TypeEfficacies[];
}
