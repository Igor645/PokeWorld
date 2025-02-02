import { Language } from './language.model';
import { Version } from './version.model';

export interface FlavorText {
  id: number;
  flavor_text: string;
  pokemon_v2_language: Language;
  pokemon_v2_version: Version;
}
