import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { GraphQLService } from './graphql.service';
import { VersionResponse } from '../models/version.model';
import { GraphQLQueries } from '../graphql/graphql-queries';

@Injectable({
  providedIn: 'root'
})
export class VersionService {
  constructor(private graphQLService: GraphQLService) {}

  /**
   * Fetches all available Pokémon versions.
   * @returns Observable containing the list of versions.
   */
  getVersions(): Observable<VersionResponse> { 
    let query = GraphQLQueries.GetVersions;
    
    return this.graphQLService.executeQuery<VersionResponse>(query);
  }
}
