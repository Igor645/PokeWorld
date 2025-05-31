import { GraphQLQueries } from '../graphql/graphql-queries';
import { GraphQLService } from './graphql.service';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PokemonTypeResponse } from '../models/pokemon-type.model';
import { SettingsService } from './settings.service';

@Injectable({
    providedIn: 'root'
})
export class TypeService {
    constructor(private graphQLService: GraphQLService, private settingsService: SettingsService) { }

    getAllTypes(): Observable<PokemonTypeResponse> {
        return this.graphQLService.executeQuery<PokemonTypeResponse>(GraphQLQueries.GetAllTypes);
    }
}
