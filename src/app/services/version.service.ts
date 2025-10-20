import { GraphQLQueries } from '../graphql/graphql-queries';
import { GraphQLService } from './graphql.service';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { VersionResponse } from '../models/version.model';

@Injectable({
  providedIn: 'root'
})
export class VersionService {
  constructor(private graphQLService: GraphQLService) { }

  /**
   * Fetches all available Pokémon versions.
   * @returns Observable containing the list of versions.
   */
  getVersions(): Observable<VersionResponse> {
    let query = GraphQLQueries.GetVersions;

    return this.graphQLService.executeQuery<VersionResponse>(query);
  }
}
