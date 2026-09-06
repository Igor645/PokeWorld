import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { GraphQLService } from './graphql.service';
import { GraphQLQueries } from '../graphql/graphql-queries';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class ItemService {
  constructor(
    private graphQLService: GraphQLService,
    private settingsService: SettingsService,
  ) {}

  getAllItems(): Observable<{ item: any[] }> {
    return this.graphQLService.executeQuery<{ item: any[] }>(GraphQLQueries.GetAllItems).pipe(
      map(res => res ?? { item: [] }),
    );
  }

  getItemsByPrefix(query: string): Observable<{ item: any[] }> {
    const languageId = this.settingsService.getSetting<number>('selectedLanguageId') || 9;
    const search = query ? `${query}%` : '%';
    return this.graphQLService.executeQuery<{ item: any[] }>(
      GraphQLQueries.GetItemsByPrefix,
      { search, languageId },
    ).pipe(map(res => res ?? { item: [] }));
  }
}
