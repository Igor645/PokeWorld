import { Language } from './language.model';
import { Version } from './version.model';
import { VersionGroup } from './version-group.model';

export interface FlavorText {
  id: number;
  flavor_text: string;
  language_id: number;
  version_group_id: number;
  language: Language;
  version: Version;
  versiongroup: VersionGroup;
}
