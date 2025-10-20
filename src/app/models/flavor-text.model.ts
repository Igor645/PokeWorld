import { Language } from './language.model';
import { Version } from './version.model';

export interface FlavorText {
  id: number;
  flavor_text: string;
  language: Language;
  version: Version;
}
