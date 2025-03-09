import { Injectable } from '@angular/core';
import { GraphQLService } from './graphql.service';
import { GraphQLQueries } from '../graphql/graphql-queries';
import { Observable } from 'rxjs';
import { GenerationResponse } from '../models/generation.model';

@Injectable({
  providedIn: 'root'
})
export class GenerationService {
  constructor(private graphQLService: GraphQLService) {}

  /**
   * Fetches all Pokémon generations with localized names.
   * @returns Observable containing all Pokémon generations.
   */
  getGenerations(): Observable<GenerationResponse> {
    return this.graphQLService.executeQuery<GenerationResponse>(
      GraphQLQueries.GetGenerations,
      {}
    );
  }
}
