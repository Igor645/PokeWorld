import { EMPTY_POKEMON_SPECIES_RESPONSE, PokemonSpeciesResponse } from '../models/pokemon-species.model';
import { Observable, catchError, map, of, switchMap } from 'rxjs';

import { GraphQLQueries } from '../graphql/graphql-queries';
import { GraphQLService } from './graphql.service';
import { Injectable } from '@angular/core';
import { PokemonMove } from '../models/pokemon-move.model';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class PokemonService {
  constructor(private graphQLService: GraphQLService, private settingsService: SettingsService) { }

  getPokemonDetails(id?: number, name?: string): Observable<PokemonSpeciesResponse> {
    if (!id && !name) throw new Error("Either 'id' or 'name' must be provided.");

    if (id) {
      return this.graphQLService
        .executeQuery<PokemonSpeciesResponse>(GraphQLQueries.GetPokemonDetailsById, { id })
        .pipe(
          map(res => res ?? EMPTY_POKEMON_SPECIES_RESPONSE),
          catchError(() => of(EMPTY_POKEMON_SPECIES_RESPONSE))
        );
    }

    return this.graphQLService
      .executeQuery<PokemonSpeciesResponse>(GraphQLQueries.GetPokemonDetailsByLocalizedName, { name })
      .pipe(
        switchMap(result => {
          if (!result?.pokemonspecies?.length) {
            return this.graphQLService
              .executeQuery<PokemonSpeciesResponse>(GraphQLQueries.GetPokemonDetailsBySlug, { name })
              .pipe(map(res => res ?? EMPTY_POKEMON_SPECIES_RESPONSE));
          }
          return of(result);
        }),
        catchError(() => of(EMPTY_POKEMON_SPECIES_RESPONSE))
      );
  }

  getPokemonSpeciesPaginated(limit: number, offset: number): Observable<PokemonSpeciesResponse> {
    return this.graphQLService
      .executeQuery<PokemonSpeciesResponse>(GraphQLQueries.GetPokemonSpeciesPaginated, { limit, offset })
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
    return this.graphQLService
      .executeQuery<PokemonSpeciesResponse>(GraphQLQueries.GetPokemonSpeciesById, { id })
      .pipe(map(res => res ?? EMPTY_POKEMON_SPECIES_RESPONSE), catchError(() => of(EMPTY_POKEMON_SPECIES_RESPONSE)));
  }

  getPokemonMoveOptions(pokemonId: number): Observable<Array<{ versiongroup: any; movelearnmethod: any }>> {
    return this.graphQLService
      .executeQuery<{ pokemon: Array<{ pokemonmoves: Array<{ versiongroup: any; movelearnmethod: any }> }> }>(
        GraphQLQueries.GetPokemonMoveOptions, { pokemonId }
      )
      .pipe(
        map(res => res?.pokemon?.[0]?.pokemonmoves ?? []),
        catchError(() => of([]))
      );
  }

  getPokemonMovesByFilter(pokemonId: number, versionGroupId: number, methodId: number): Observable<PokemonMove[]> {
    return this.graphQLService
      .executeQuery<{ pokemon: Array<{ pokemonmoves: PokemonMove[] }> }>(
        GraphQLQueries.GetPokemonMovesByFilter, { pokemonId, versionGroupId, methodId }
      )
      .pipe(
        map(res => res?.pokemon?.[0]?.pokemonmoves ?? []),
        catchError(() => of([]))
      );
  }
}
