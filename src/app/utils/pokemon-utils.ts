import { PokemonSpecies } from '../models/pokemon-species.model';
import {Pokemon} from '../models/pokemon.model'
import { Name } from '../models/species-name.model';

/**
 * Get the official Pokémon image.
 * @param pokemon The Pokémon DTO object.
 * @returns The URL of the Pokémon's official artwork.
 */
export function getPokemonOfficialImage(pokemon: Pokemon | undefined): string {
  return (
    pokemon?.pokemon_v2_pokemonsprites?.[0]?.sprites.other?.["official-artwork"]?.front_default ||
    '/invalid/image.png'
  );
}

/**
 * Get the Pokémon species name by language.
 * @param pokemonSpecies The Pokémon species DTO object.
 * @param language The language code (e.g., 'en').
 * @returns The Pokémon species name in the specified language.
 */
export function getPokemonSpeciesNameByLanguage(
  pokemonSpecies: PokemonSpecies | undefined,
  language: string
): string {
  return (
    pokemonSpecies?.pokemon_v2_pokemonspeciesnames?.find((x) => x.pokemon_v2_language.name === language)
      ?.name || 'Unknown'
  );
}

/**
 * Get the Pokémon species name by language.
 * @param pokemonSpecies The Pokémon species DTO object.
 * @param language The language code (e.g., 'en').
 * @returns The Pokémon species name in the specified language.
 */
export function getNameByLanguage(
  names: Name[] | undefined,
  language: string
): string {
  return (
    names?.find((x) => x.pokemon_v2_language.name === language)
      ?.name || 'Unknown'
  );
}

/**
 * Get the Pokémon species Pokédex entry (flavor text) by language and version.
 * @param pokemonSpecies The Pokémon species DTO object.
 * @param language The language code (e.g., 'en').
 * @param version The Pokémon game version (optional).
 * @returns The formatted Pokédex entry.
 */
export function getPokemonSpeciesDexEntryByLanguageAndVersion(
  pokemonSpecies: PokemonSpecies | undefined,
  language: string,
  version: string | null
): string {
  const isNoVersionCheck = !version;
  const flavortext = pokemonSpecies?.pokemon_v2_pokemonspeciesflavortexts?.find(
    (x) =>
      x.pokemon_v2_language.name === language &&
      (isNoVersionCheck || x.pokemon_v2_version.name === version)
  )?.flavor_text;

  return flavortext ? flavortext.replace(/\f/g, ' ') : 'No entry available.';
}
