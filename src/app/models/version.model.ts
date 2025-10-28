import { Name } from "./name.model";

export interface Version {
  id: number;
  name: string;
  versionnames: Name[];
}

export interface VersionResponse {
  version: Version[];
}
