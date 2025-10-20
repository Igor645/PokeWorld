import { GraphQLQueries } from '../graphql/graphql-queries';
import { GraphQLService } from './graphql.service';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PokemonEvolutionResponse } from '../models/pokemon-evolution.model';
import { SettingsService } from './settings.service';

@Injectable({
  providedIn: 'root'
})
export class EvolutionService {
  constructor(private graphQLService: GraphQLService, private settingsService: SettingsService) { }

  getPokemonEvolution(id: number): Observable<PokemonEvolutionResponse> {
    const variables = { id };
    return this.graphQLService.executeQuery<PokemonEvolutionResponse>(GraphQLQueries.GetPokemonEvolutions, variables);
  }
}
