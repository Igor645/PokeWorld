import { Injectable } from '@angular/core';
import { SettingsService } from '../services/settings.service';
import { PokemonSpecies } from '../models/pokemon-species.model';
import { Pokemon } from '../models/pokemon.model';
import { Name } from '../models/species-name.model';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PokemonUtilsService {
  private selectedLanguageId$ = new BehaviorSubject<number>(9); // Default: English (ID 9)

  constructor(private settingsService: SettingsService) {
    this.settingsService.watchSetting<number>('selectedLanguageId')
      .subscribe(id => {
        this.selectedLanguageId$.next(id);
      });
  }

  /**
   * Get the selected language ID reactively.
   * @returns The selected language ID.
   */
  private getSelectedLanguageId(): number {
    return this.selectedLanguageId$.getValue();
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
   * Get the Pokémon species Pokédex entry (flavor text) by the selected language ID and version.
   * @param pokemonSpecies The Pokémon species DTO object.
   * @param version The Pokémon game version (optional).
   * @returns The formatted Pokédex entry.
   */
  getPokemonSpeciesDexEntryByVersion(
    pokemonSpecies: PokemonSpecies | undefined,
    version: string | null
  ): string {
    const languageId = this.getSelectedLanguageId();
    const isNoVersionCheck = !version;
    const flavortext = pokemonSpecies?.pokemon_v2_pokemonspeciesflavortexts?.find(
      (x) =>
        x.pokemon_v2_language.id === languageId &&
        (isNoVersionCheck || x.pokemon_v2_version.name === version)
    )?.flavor_text;

    return flavortext ? flavortext.replace(/\f/g, ' ') : 'No entry available.';
  }
}
