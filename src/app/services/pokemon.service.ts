import { Injectable } from '@angular/core';
import { GraphQLService } from './graphql.service';
import { GraphQLQueries } from '../graphql/graphql-queries';
import { Observable } from 'rxjs';
import { PokemonSpeciesResponse } from '../models/pokemon-species.model';
import { SettingsService } from './settings.service';

@Injectable({
  providedIn: 'root'
})
export class PokemonService {
  constructor(private graphQLService: GraphQLService, private settingsService: SettingsService) {}

  /**
   * Fetches Pokémon details by ID or name.
   * @param id Pokémon ID (optional)
   * @param name Pokémon name (optional)
   * @returns Observable containing Pokémon details
   */
  getPokemonDetails(id?: number, name?: string): Observable<PokemonSpeciesResponse> {    
    if (!id && !name) {
        throw new Error("Either 'id' or 'name' must be provided.");
    }

    const formattedName = name
    ? name
        .split(' ')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ')
    : null;
   let query = GraphQLQueries.GetPokemonDetails;
    let variables: any = {};

    if (id) {
        variables = { value: id };
        query = query.replace("{FILTER}", "id: { _eq: $value }").replace("{TYPE}", "Int");
    } else if (formattedName) {
        variables = { value: formattedName };
        query = query.replace("{FILTER}", "pokemon_v2_pokemonspeciesnames: { name: { _eq: $value } }").replace("{TYPE}", "String");
    }

    return this.graphQLService.executeQuery<PokemonSpeciesResponse>(query, variables);
}


  /**
   * Fetches a paginated list of Pokémon species.
   * @param limit Number of species to fetch
   * @param offset Offset for pagination
   * @returns Observable containing paginated Pokémon species
   */
  getPokemonSpeciesPaginated(limit: number, offset: number): Observable<PokemonSpeciesResponse> {
    const variables = { limit, offset };
    return this.graphQLService.executeQuery<PokemonSpeciesResponse>(GraphQLQueries.GetPokemonSpeciesPaginated, variables);
  }

  /**
   * Fetches Pokémon species that match a given prefix.
   * If the prefix is empty, fetches the first 15 species.
   * @param prefix Search string (optional)
   * @returns Observable containing matching Pokémon species
   */
  getPokemonSpeciesByPrefix(prefix: string): Observable<PokemonSpeciesResponse> {
    const isPrefixEmpty = !prefix || prefix.trim() === "";
    const query = isPrefixEmpty
      ? GraphQLQueries.GetPokemonSpeciesWithoutPrefix
      : GraphQLQueries.GetPokemonSpeciesByPrefix;
  
    const languageId = this.settingsService.getSetting<number>('selectedLanguageId') || 9; // Default to English (9)
    const variables = isPrefixEmpty ? null : { search: `${prefix}%`, languageId };
  
    return this.graphQLService.executeQuery<PokemonSpeciesResponse>(query, variables);
  }  

  /**
   * Fetches **all** Pokémon species at once (no pagination).
   * @returns Observable containing all Pokémon species
   */
  getAllPokemonSpecies(): Observable<PokemonSpeciesResponse> {
    return this.graphQLService.executeQuery<PokemonSpeciesResponse>(GraphQLQueries.GetPokemonSpeciesAll, {});
  }

  /**
   * Fetches Pokémon species by its ID.
   * @param id Pokémon species ID.
   * @returns Observable containing the Pokémon species details.
   */
  getPokemonSpeciesById(id: number): Observable<PokemonSpeciesResponse> {
  const variables = { id };
  return this.graphQLService.executeQuery<PokemonSpeciesResponse>(
    GraphQLQueries.GetPokemonSpeciesById,
    variables
  );
  }
}
