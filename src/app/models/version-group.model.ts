import { Generation } from "./generation.model";
import { Version } from "./version.model";

export interface VersionGroup {
    id: number;
    name: string;
    generation: Generation;
    versions: Version[];
}
