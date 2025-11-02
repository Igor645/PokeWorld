import { Injectable } from '@angular/core';
import { LanguageService } from '../services/language.service';
import { Name } from '../models/name.model';
import { Observable } from 'rxjs';
import { Pokemon } from '../models/pokemon.model';
import { PokemonAbility } from '../models/pokemon-ability.model';
import { PokemonSpecies } from '../models/pokemon-species.model';

@Injectable({
  providedIn: 'root'
})
export class PokemonUtilsService {
  constructor(private languageService: LanguageService) { }

  /**
   * Get the selected language ID.
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

  /**
   * Get a localized name by language from an array of names.
   * @param names The name array.
   * @returns The localized name or 'Unknown'.
   */
  private getNameByLanguage(names: Name[] | undefined): string {
    const languageId = this.getSelectedLanguageId();
    return (
      names?.find((x) => x.language_id === languageId)?.name || 'Unknown'
    );
  }

  /**
   * Get a localized name from an entity.
   * @param entity The object that contains a names array.
   * @param namesKey The key where names are stored (e.g., "pokemon_species_names").
   * @returns The localized and formatted name.
   */
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
   * Get a localized flavor text from an entity.
   * @param entity The object containing flavor text entries (e.g., pokemonspeciesflavortexts).
   * @param flavorTextsKey The key where flavor texts are stored.
   * @param versionId Optional version ID to filter by.
   * @returns The localized flavor text or a fallback.
   */
  getLocalizedFlavorTextFromEntity(
    entity: any,
    flavorTextsKey: string,
    versionOrGroupId: number | null = null
  ): string {
    const languageId = this.getSelectedLanguageId();
    const list: any[] = entity?.[flavorTextsKey] ?? [];

    const pick = (xs: any[]) => xs.find(e => {
      const eLangId = e?.language_id ?? e?.language?.id;
      const eVer =
        e?.version?.id ??
        e?.version_id ??
        e?.versiongroup?.id ??
        e?.version_group_id ??
        null;

      const versionOk =
        versionOrGroupId == null || eVer == null || eVer === versionOrGroupId;

      return eLangId === languageId && versionOk;
    });

    const match = pick(list) ?? list.find(e => (e?.language_id ?? e?.language?.id) === languageId);

    const text: string | undefined = match?.flavor_text;
    return text ? text.replace(/[\f\r\n]+/g, ' ').replace(/\s+/g, ' ').trim() : 'No entry available.';
  }
}
