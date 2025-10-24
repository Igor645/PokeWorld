export interface Language {
  name: string;
  id: number;
}

export interface LanguageResponse {
  language: Language[];
}

export const EMPTY_LANGUAGE_RESPONSE: LanguageResponse = {
  language: []
};
