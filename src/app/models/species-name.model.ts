import { Language } from './language.model';

export interface Name {
  id: number;
  name: string;
  language_id: number;
  pokemon_v2_language: Language;
}
