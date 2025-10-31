import { Move } from "./move.model";
import { VersionGroup } from "./version-group.model";

export interface PokemonMove {
    id: number;
    level: number;
    move: Move;
    versiongroup: VersionGroup;
}
