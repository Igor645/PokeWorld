export interface Language {
  name: string;
  id: number;
}

export interface LanguageResponse {
  pokemon_v2_language: Language[];
}
