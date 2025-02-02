import { Injectable } from '@angular/core';
import { GraphQLService } from './graphql.service';
import { GraphQLQueries } from '../graphql/graphql-queries';
import { Observable } from 'rxjs';
import { PokemonSpeciesResponse } from '../models/pokemon-species.model';

@Injectable({
  providedIn: 'root'
})
export class PokemonService {
  constructor(private graphQLService: GraphQLService) {}

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

    const formattedName = name ? name.charAt(0).toUpperCase() + name.slice(1).toLowerCase() : null;
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
    
    const variables = isPrefixEmpty ? null : { search: `${prefix}%` };

    return this.graphQLService.executeQuery<PokemonSpeciesResponse>(query, variables);
  }

  /**
   * Fetches **all** Pokémon species at once (no pagination).
   * @returns Observable containing all Pokémon species
   */
  getAllPokemonSpecies(): Observable<PokemonSpeciesResponse> {
    return this.graphQLService.executeQuery<PokemonSpeciesResponse>(GraphQLQueries.GetPokemonSpeciesAll, {});
  }
}
