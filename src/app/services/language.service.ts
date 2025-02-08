import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { GraphQLService } from './graphql.service';
import { Language, LanguageResponse } from '../models/language.model';
import { GraphQLQueries } from '../graphql/graphql-queries';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  constructor(private graphQLService: GraphQLService) {}

  /**
   * Fetches all available Pokémon languages.
   * @returns Observable containing the list of languages.
   */
  getLanguages(): Observable<LanguageResponse> { 
    let query = GraphQLQueries.GetLanguages;
    
    return this.graphQLService.executeQuery<LanguageResponse>(query);
  }
}
