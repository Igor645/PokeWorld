import { EvolutionTrigger } from '../models/evolution-trigger.model';
import { Injectable } from '@angular/core';
import { LanguageService } from '../services/language.service';
import { Name } from '../models/name.model';
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
      pokemon?.pokemonsprites?.[0]?.sprites.other?.["official-artwork"]?.front_default ||
      '/invalid/image.png'
    );
  }

  private getNameByLanguage(names: Name[] | undefined): string {
    const languageId = this.getSelectedLanguageId();
    return (
      names?.find((x) => x.language_id === languageId)
        ?.name || 'Unknown'
    );
  }

  getLocalizedNameFromEntity(entity: any, namesKey: string): string {
    const entitynames = entity?.[namesKey];
    const fallbackName = entity?.name || 'Unknown';
    const localized = this.getNameByLanguage(entitynames ?? []);
    const rawName = localized !== 'Unknown' ? localized : fallbackName;

    return typeof rawName === 'string' && rawName.length > 0
      ? rawName.charAt(0).toUpperCase() + rawName.slice(1)
      : 'Unknown';
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

    const flavortext = pokemonSpecies?.pokemonspeciesflavortexts?.find(
      (entry) =>
        entry.language.id === languageId &&
        (isNoVersionCheck || entry.version.id === versionId)
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

    const flavorText = ability?.abilityflavortexts?.find(
      (entry) => entry.language.id === languageId
    )?.flavor_text;

    return flavorText ? flavorText.replace(/\f/g, ' ') : 'No ability description available.';
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

    const localizedVersion = versionNames.find(name => name.language_id === languageId)?.name;

    return localizedVersion || 'Unknown Version';
  }
}
