import { Name } from "./species-name.model";

export interface Version {
  id: number;
  name: string;
  pokemon_v2_versionnames: Name[];
}

export interface VersionResponse {
  pokemon_v2_version: Version[];
}
  