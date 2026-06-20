import { GraphQLQueries } from '../graphql/graphql-queries';
import { GraphQLService } from './graphql.service';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PokemonEvolutionResponse } from '../models/pokemon-evolution.model';

@Injectable({
  providedIn: 'root'
})
export class EvolutionService {
  constructor(private graphQLService: GraphQLService) { }

  getPokemonEvolutionsByIds(ids: number[]): Observable<PokemonEvolutionResponse> {
    return this.graphQLService.executeQuery<PokemonEvolutionResponse>(
      GraphQLQueries.GetPokemonEvolutionsByIds, { ids }
    );
  }
}
