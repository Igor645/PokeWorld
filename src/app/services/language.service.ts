import { BehaviorSubject, Observable, of, shareReplay, tap } from 'rxjs';
import { Language, LanguageResponse } from '../models/language.model';

import { GraphQLQueries } from '../graphql/graphql-queries';
import { GraphQLService } from './graphql.service';
import { Injectable } from '@angular/core';
import { SettingsService } from './settings.service';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private selectedLanguageId$ = new BehaviorSubject<number>(9);
  private cachedLanguages: Language[] | null = null;
  private languages$: Observable<LanguageResponse> | null = null;

  constructor(
    private settingsService: SettingsService,
    private graphQLService: GraphQLService
  ) {
    this.settingsService.watchSetting<number>('selectedLanguageId').subscribe(id => {
      this.setSelectedLanguageId(id ?? 9);
    });

    this.getLanguages().subscribe();
  }

  getLanguages(): Observable<LanguageResponse> {
    if (this.cachedLanguages) {
      return of({ language: this.cachedLanguages });
    }

    if (!this.languages$) {
      this.languages$ = this.graphQLService.executeQuery<LanguageResponse>(GraphQLQueries.GetLanguages).pipe(
        tap(response => {
          this.cachedLanguages = response.language;
        }),
        shareReplay(1)
      );
    }

    return this.languages$;
  }

  setSelectedLanguageId(id: number) {
    this.selectedLanguageId$.next(id);
  }

  getSelectedLanguageId(): number {
    return this.selectedLanguageId$.getValue();
  }

  watchLanguageChanges(): Observable<number> {
    return this.selectedLanguageId$.asObservable();
  }
}
