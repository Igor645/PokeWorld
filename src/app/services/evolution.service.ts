import { Injectable } from '@angular/core';
import { GraphQLService } from './graphql.service';
import { GraphQLQueries } from '../graphql/graphql-queries';
import { Observable } from 'rxjs';
import { SettingsService } from './settings.service';
import { PokemonEvolutionResponse } from '../models/pokemon-evolution.model';

@Injectable({
  providedIn: 'root'
})
export class EvolutionService {
  constructor(private graphQLService: GraphQLService, private settingsService: SettingsService) {}

    getPokemonEvolution(id: number): Observable<PokemonEvolutionResponse> {
        const variables = { id };
        return this.graphQLService.executeQuery<PokemonEvolutionResponse>(GraphQLQueries.GetPokemonEvolutions, variables);
    }
}
