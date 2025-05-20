import { EvolutionTrigger } from '../models/evolution-trigger.model';
import { Injectable } from '@angular/core';
import { LanguageService } from '../services/language.service';
import { Name } from '../models/species-name.model';
import { Observable } from 'rxjs';
import { Pokemon } from '../models/pokemon.model';
import { PokemonAbility } from '../models/pokemon-ability.model';
import { PokemonSpecies } from '../models/pokemon-species.model';
import { Version } from '../models/version.model';

@Injectable({
  providedIn: 'root'
})
export class PokemonUtilsService {
  constructor(private languageService: LanguageService) { }

  /**
   * Get the selected language ID reactively.
   * @returns The selected language ID.
   */
  public getSelectedLanguageId(): number {
    return this.languageService.getSelectedLanguageId();
  }

  /**
   * Watch for language changes.
   * @returns An Observable that emits when the language changes.
   */
  watchLanguageChanges(): Observable<number> {
    return this.languageService.watchLanguageChanges();
  }

  /**
   * Get the official Pokémon image.
   * @param pokemon The Pokémon DTO object.
   * @returns The URL of the Pokémon's official artwork.
   */
  getPokemonOfficialImage(pokemon: Pokemon | undefined): string {
    return (
      pokemon?.pokemon_v2_pokemonsprites?.[0]?.sprites.other?.["official-artwork"]?.front_default ||
      '/invalid/image.png'
    );
  }

  /**
   * Get the Pokémon species name by the selected language ID.
   * @param pokemonSpecies The Pokémon species DTO object.
   * @returns The Pokémon species name in the selected language.
   */
  getPokemonSpeciesNameByLanguage(pokemonSpecies: PokemonSpecies | undefined): string {
    const languageId = this.getSelectedLanguageId();
    return (
      pokemonSpecies?.pokemon_v2_pokemonspeciesnames?.find((x) => x.pokemon_v2_language.id === languageId)
        ?.name || 'Unknown'
    );
  }

  /**
   * Get the Pokémon name from a list of translations based on the selected language ID.
   * @param names The list of names.
   * @returns The name in the selected language.
   */
  getNameByLanguage(names: Name[] | undefined): string {
    const languageId = this.getSelectedLanguageId();
    return (
      names?.find((x) => x.pokemon_v2_language.id === languageId)
        ?.name || 'Unknown'
    );
  }

  /**
   * Get the Pokémon species Pokédex entry (flavor text) by the selected language ID and version ID.
   * @param pokemonSpecies The Pokémon species DTO object.
   * @param versionId The Pokémon game version ID (optional).
   * @returns The formatted Pokédex entry.
   */
  getPokemonSpeciesDexEntryByVersion(
    pokemonSpecies: PokemonSpecies | undefined,
    versionId: number | null
  ): string {
    const languageId = this.getSelectedLanguageId();
    const isNoVersionCheck = versionId === null;

    const flavortext = pokemonSpecies?.pokemon_v2_pokemonspeciesflavortexts?.find(
      (entry) =>
        entry.pokemon_v2_language.id === languageId &&
        (isNoVersionCheck || entry.pokemon_v2_version.id === versionId)
    )?.flavor_text;

    return flavortext ? flavortext.replace(/\f/g, ' ') : 'No entry available.';
  }

  /**
   * Get the Pokémon ability flavor text by the selected language ID.
   * @param ability The Pokémon ability DTO object.
   * @returns The formatted ability flavor text.
   */
  getAbilityFlavorTextByLanguage(ability: PokemonAbility): string {
    const languageId = this.getSelectedLanguageId();

    const flavorText = ability?.pokemon_v2_abilityflavortexts?.find(
      (entry) => entry.pokemon_v2_language.id === languageId
    )?.flavor_text;

    return flavorText ? flavorText.replace(/\f/g, ' ') : 'No ability description available.';
  }

  /**
   * Parses the generation name and returns it in the selected language.
   * @param generationNames The list of translated generation names.
   * @returns The formatted generation name based on language preference.
   */
  parseGenerationName(generationNames: Name[] | undefined): string {
    if (!generationNames || generationNames.length === 0) {
      return 'Unknown Generation';
    }

    const languageId = this.getSelectedLanguageId();
    const localizedGeneration = generationNames.find(name => name.pokemon_v2_language.id === languageId)?.name;

    return localizedGeneration || 'Unknown Generation';
  }

  /**
   * Filters an array of versions to include only those that match the selected language ID.
   * @param versionNames The array of versionnames.
   * @returns Filtered array of versions in the selected language.
   */
  getVersionNameByLanguage(versionNames: Name[] | undefined): string {
    if (!versionNames) {
      return 'Unknown Version';
    }

    const languageId = this.getSelectedLanguageId();

    const localizedVersion = versionNames.find(name => name.pokemon_v2_language.id === languageId)?.name;

    return localizedVersion || 'Unknown Version';
  }
}
