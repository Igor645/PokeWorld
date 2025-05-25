import { Language } from "./language.model";

export interface Description {
    description: string;
    id: number;
    language_id: number;
    pokemon_v2_language: Language;
}
