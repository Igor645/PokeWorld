import { Injectable } from '@angular/core';
import { Observable, asyncScheduler, from, of, shareReplay, tap, throwError, timer } from 'rxjs';
import { catchError, observeOn, retry } from 'rxjs/operators';
import { ClientError, request } from 'graphql-request';
import { DocumentNode, print } from 'graphql';
import { environment } from '../../environments/environment';
import { isBrowser } from '../utils/platform';
import { ErrorToastService } from './error-toast.service';

const MEM_TTL_MS        = 4 * 60 * 60 * 1000;
const STORAGE_TTL_MS    = 7 * 24 * 60 * 60 * 1000;
const MAX_PERSIST_BYTES = 1.5 * 1024 * 1024;
const STORAGE_KEY       = 'gql-cache-v2';

@Injectable({ providedIn: 'root' })
export class GraphQLService {
  private endpoint = environment.apiUrl;
  private cache    = new Map<string, { data: any; ts: number }>();
  private inFlight = new Map<string, Observable<any>>();

  // Singleton toast IDs — one active toast per error category at most.
  private rateLimitToastId:  number | null = null;
  private networkToastId:    number | null = null;
  private serverToastId:     number | null = null;

  constructor(private errorToast: ErrorToastService) {
    this.hydrateFromStorage();
    if (isBrowser) this.registerConnectivityListeners();
  }

  executeQuery<T>(query: string | DocumentNode, variables?: any): Observable<T> {
    const key = this.cacheKey(query, variables);

    if (!isBrowser) {
      const hit = this.cache.get(key);
      return hit ? of(hit.data as T) : of(undefined as unknown as T);
    }

    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.ts < MEM_TTL_MS) {
      return of(hit.data as T).pipe(observeOn(asyncScheduler));
    }

    return this.fetchAndCache<T>(key, query, variables);
  }

  private fetchAndCache<T>(key: string, query: string | DocumentNode, variables?: any): Observable<T> {
    if (this.inFlight.has(key)) return this.inFlight.get(key) as Observable<T>;

    const req$ = from(request<T>(this.endpoint, query, variables)).pipe(
      retry({
        count: 4,
        delay: (err, attempt) => {
          const status = this.extractStatus(err);
          if (status === 429 || status === 502 || status === 503) {
            if (attempt === 1 && this.rateLimitToastId === null) {
              this.rateLimitToastId = this.errorToast.showRateLimit();
            }
            return timer(Math.pow(2, attempt) * 1000); // 2 s → 4 s → 8 s → 16 s
          }
          return throwError(() => err);
        },
      }),
      tap(data => {
        this.cache.set(key, { data, ts: Date.now() });
        this.persistEntry(data);
        this.dismissActiveErrorToasts();
      }),
      catchError(err => {
        const status = this.extractStatus(err);

        if (status === 429 || status === 502 || status === 503) {
          // Retries exhausted — keep the rate-limit toast up, don't add another.
          if (this.rateLimitToastId === null) {
            this.rateLimitToastId = this.errorToast.showRateLimit();
          }
        } else if (!status || status === 0) {
          if (this.networkToastId === null) {
            const isOnline = navigator.onLine;
            this.networkToastId = this.errorToast.show({
              type: 'error',
              title: isOnline ? 'PokéAPI is unreachable' : 'No internet connection',
              detail: isOnline
                ? 'The Pokémon database appears to be down. Data will load from cache where available.'
                : 'Check your network — Pokémon data cannot be loaded.',
              // Persistent — dismissed when a request succeeds or the 'online' event fires.
            });
          }
        } else if (status >= 500) {
          if (this.serverToastId === null) {
            this.serverToastId = this.errorToast.show({
              type: 'error',
              title: 'PokéAPI server error',
              detail: `The Pokémon database returned an error (${status}). Try again in a moment.`,
              autoDismiss: 8000,
            });
            setTimeout(() => { this.serverToastId = null; }, 8000);
          }
        }

        return throwError(() => err);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.inFlight.set(key, req$);
    req$.subscribe({
      complete: () => this.inFlight.delete(key),
      error:    () => this.inFlight.delete(key),
    });

    return req$;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private registerConnectivityListeners(): void {
    window.addEventListener('offline', () => {
      if (this.networkToastId === null) {
        this.networkToastId = this.errorToast.show({
          type: 'error',
          title: 'No internet connection',
          detail: 'Check your network — Pokémon data cannot be loaded.',
        });
      }
    });

    window.addEventListener('online', () => {
      if (this.networkToastId !== null) {
        this.errorToast.dismiss(this.networkToastId);
        this.networkToastId = null;
      }
      this.errorToast.show({
        type: 'info',
        title: 'Back online',
        detail: 'Connection restored — refresh the page to reload data.',
        autoDismiss: 4000,
      });
    });
  }

  private extractStatus(err: unknown): number {
    // ClientError from graphql-request carries response.status
    const clientStatus = (err as ClientError)?.response?.status;
    if (clientStatus) return clientStatus;

    // Hasura sometimes rate-limits via message rather than status code
    const msg = ((err as Error)?.message ?? '').toLowerCase();
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many')) return 429;

    return 0;
  }

  private dismissActiveErrorToasts(): void {
    if (this.rateLimitToastId !== null) {
      this.errorToast.dismiss(this.rateLimitToastId);
      this.rateLimitToastId = null;
    }
    if (this.networkToastId !== null) {
      this.errorToast.dismiss(this.networkToastId);
      this.networkToastId = null;
    }
    if (this.serverToastId !== null) {
      this.errorToast.dismiss(this.serverToastId);
      this.serverToastId = null;
    }
  }

  // ── localStorage persistence ──────────────────────────────────────────────────

  private hydrateFromStorage(): void {
    if (!isBrowser) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const entries: Array<[string, { data: any; ts: number }]> = JSON.parse(raw);
      const cutoff = Date.now() - STORAGE_TTL_MS;
      let pruned = false;
      for (const [k, v] of entries) {
        if (v.ts > cutoff) { this.cache.set(k, v); } else { pruned = true; }
      }
      if (pruned) this.flushStorage();
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private persistEntry(data: any): void {
    if (!isBrowser) return;
    try {
      if (JSON.stringify(data).length > MAX_PERSIST_BYTES) return;
      this.flushStorage();
    } catch {}
  }

  private flushStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(this.cache.entries())));
    } catch {}
  }

  // ── Cache key ─────────────────────────────────────────────────────────────────

  private cacheKey(query: string | DocumentNode, variables?: any): string {
    const q = typeof query === 'string'
      ? query.replace(/\s+/g, ' ').trim()
      : print(query).replace(/\s+/g, ' ').trim();
    return JSON.stringify({ q, v: variables ?? {} });
  }
}
