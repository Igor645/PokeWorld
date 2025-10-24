import { EMPTY_POKEMON_SPECIES_RESPONSE, PokemonSpeciesResponse } from '../models/pokemon-species.model';
import { Observable, catchError, map, of, switchMap } from 'rxjs';

import { GraphQLQueries } from '../graphql/graphql-queries';
import { GraphQLService } from './graphql.service';
import { Injectable } from '@angular/core';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class PokemonService {
  constructor(private graphQLService: GraphQLService, private settingsService: SettingsService) { }

  getPokemonDetails(id?: number, name?: string): Observable<PokemonSpeciesResponse> {
    if (!id && !name) throw new Error("Either 'id' or 'name' must be provided.");

    const execute = (filter: string): Observable<PokemonSpeciesResponse> => {
      const query = GraphQLQueries.GetPokemonDetails
        .replace('{FILTER}', filter)
        .replace('{TYPE}', id ? 'Int' : 'String');
      const variables = { value: id ?? name };
      return this.graphQLService.executeQuery<PokemonSpeciesResponse>(query, variables).pipe(
        map(res => res ?? EMPTY_POKEMON_SPECIES_RESPONSE),
        catchError(() => of(EMPTY_POKEMON_SPECIES_RESPONSE))
      );
    };

    if (id) return execute('id: { _eq: $value }');

    const localizedFilter = 'pokemonspeciesnames: { name: { _ilike: $value } }';
    const basicNameFilter = 'name: { _ilike: $value }';
    return execute(localizedFilter).pipe(
      switchMap(result => {
        const species = result?.pokemonspecies;
        if (!species || species.length === 0) return execute(basicNameFilter);
        return of(result);
      }),
      catchError(() => of(EMPTY_POKEMON_SPECIES_RESPONSE))
    );
  }

  getPokemonSpeciesPaginated(limit: number, offset: number): Observable<PokemonSpeciesResponse> {
    const variables = { limit, offset };
    return this.graphQLService
      .executeQuery<PokemonSpeciesResponse>(GraphQLQueries.GetPokemonSpeciesPaginated, variables)
      .pipe(map(res => res ?? EMPTY_POKEMON_SPECIES_RESPONSE), catchError(() => of(EMPTY_POKEMON_SPECIES_RESPONSE)));
  }

  getPokemonSpeciesByPrefix(prefix: string): Observable<PokemonSpeciesResponse> {
    const isPrefixEmpty = !prefix || prefix.trim() === '';
    const query = isPrefixEmpty
      ? GraphQLQueries.GetPokemonSpeciesWithoutPrefix
      : GraphQLQueries.GetPokemonSpeciesByPrefix;
    const languageId = this.settingsService.getSetting<number>('selectedLanguageId') || 9;
    const variables = isPrefixEmpty ? null : { search: `${prefix}%`, languageId };
    return this.graphQLService
      .executeQuery<PokemonSpeciesResponse>(query, variables)
      .pipe(map(res => res ?? EMPTY_POKEMON_SPECIES_RESPONSE), catchError(() => of(EMPTY_POKEMON_SPECIES_RESPONSE)));
  }

  getAllPokemonSpecies(): Observable<PokemonSpeciesResponse> {
    return this.graphQLService
      .executeQuery<PokemonSpeciesResponse>(GraphQLQueries.GetPokemonSpeciesAll, {})
      .pipe(map(res => res ?? EMPTY_POKEMON_SPECIES_RESPONSE), catchError(() => of(EMPTY_POKEMON_SPECIES_RESPONSE)));
  }

  getPokemonSpeciesById(id: number): Observable<PokemonSpeciesResponse> {
    const variables = { id };
    return this.graphQLService
      .executeQuery<PokemonSpeciesResponse>(GraphQLQueries.GetPokemonSpeciesById, variables)
      .pipe(map(res => res ?? EMPTY_POKEMON_SPECIES_RESPONSE), catchError(() => of(EMPTY_POKEMON_SPECIES_RESPONSE)));
  }
}
