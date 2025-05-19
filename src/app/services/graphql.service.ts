import { Apollo, gql } from 'apollo-angular';
import { Observable, map } from 'rxjs';

import { ApolloQueryResult } from '@apollo/client/core';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GraphQLService {
  constructor(private apollo: Apollo) { }

  executeQuery<T>(query: string, variables?: any): Observable<T> {
    return this.apollo.query<T>({
      query: gql(query),
      variables,
      fetchPolicy: 'network-only'
    }).pipe(
      map((result: ApolloQueryResult<T>) => result.data)
    );
  }

  executeMutation<T>(mutation: string, variables?: any): Observable<T> {
    return this.apollo.mutate<T>({
      mutation: gql(mutation),
      variables
    }).pipe(
      map(result => result.data as T)
    );
  }
}
