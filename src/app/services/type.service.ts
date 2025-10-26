import { EMPTY_POKEMON_TYPE_RESPONSE, PokemonTypeResponse } from '../models/pokemon-type.model';
import { Observable, map } from 'rxjs';

import { GraphQLQueries } from '../graphql/graphql-queries';
import { GraphQLService } from './graphql.service';
import { Injectable } from '@angular/core';
import { SettingsService } from './settings.service';

@Injectable({
    providedIn: 'root'
})
export class TypeService {
    constructor(private graphQLService: GraphQLService, private settingsService: SettingsService) { }

    getAllTypes(): Observable<PokemonTypeResponse> {
        return this.graphQLService.executeQuery<PokemonTypeResponse>(GraphQLQueries.GetAllTypes).pipe(
            map(res => res ?? EMPTY_POKEMON_TYPE_RESPONSE)
        );
    }
}
