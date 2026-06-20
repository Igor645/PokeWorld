import { Injectable } from '@angular/core';
import { Observable, from, of, shareReplay, tap } from 'rxjs';
import { request } from 'graphql-request';
import { DocumentNode, print } from 'graphql';
import { environment } from '../../environments/environment';
import { isBrowser } from '../utils/platform';

const TTL_MS = 15 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class GraphQLService {
  private endpoint = environment.apiUrl;
  private cache = new Map<string, { data: any; ts: number }>();
  private inFlight = new Map<string, Observable<any>>();

  executeQuery<T>(query: string | DocumentNode, variables?: any): Observable<T> {
    const key = this.cacheKey(query, variables);

    if (!isBrowser) {
      const hit = this.cache.get(key);
      return hit ? of(hit.data as T) : of(undefined as unknown as T);
    }

    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.ts < TTL_MS) return of(hit.data as T);

    return this.fetchAndCache<T>(key, query, variables);
  }

  private fetchAndCache<T>(key: string, query: string | DocumentNode, variables?: any): Observable<T> {
    if (this.inFlight.has(key)) return this.inFlight.get(key) as Observable<T>;

    const req$ = from(request<T>(this.endpoint, query, variables)).pipe(
      tap(data => this.cache.set(key, { data, ts: Date.now() })),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.inFlight.set(key, req$);
    req$.subscribe({
      complete: () => this.inFlight.delete(key),
      error: () => this.inFlight.delete(key),
    });

    return req$;
  }

  private cacheKey(query: string | DocumentNode, variables?: any): string {
    const q = typeof query === 'string'
      ? query.replace(/\s+/g, ' ').trim()
      : print(query).replace(/\s+/g, ' ').trim();
    return JSON.stringify({ q, v: variables ?? {} });
  }
}
