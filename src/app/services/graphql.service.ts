// services/graphql.service.ts

import { Observable, from, of, shareReplay, tap } from 'rxjs';
import { gql, request } from 'graphql-request';

import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { isBrowser } from '../utils/platform';

type Policy = 'cache-first' | 'cache-and-network' | 'network-only';
type Stats = { total: number; lastMinute: number; byKey: Record<string, number> };

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const MAX_MEMORY_ENTRIES = 500;

function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  const msg = typeof e === 'string' ? e : (e && (e as any).message) || 'Unknown error';
  return new Error(String(msg));
}
function isAbort(e: unknown): boolean {
  return !!e && ((e as any).name === 'AbortError' || (e as any).code === 'ABORT_ERR');
}
function stableStringify(value: any): any {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stableStringify);
  const out: Record<string, any> = {};
  for (const k of Object.keys(value).sort()) out[k] = stableStringify(value[k]);
  return out;
}
function normalizeQuery(q: string): string {
  return q.replace(/#.*$/gm, '').replace(/\s+/g, ' ').trim();
}

@Injectable({ providedIn: 'root' })
export class GraphQLService {
  private endpoint = environment.apiUrl;
  private inFlight = new Map<string, Observable<any>>();
  private memory = new Map<string, { data: any; ts: number }>();
  private stats: Stats = { total: 0, lastMinute: 0, byKey: {} };
  private lastMinuteQueue: number[] = [];

  constructor() {
    if (isBrowser) (window as any).gqlStats = () => ({ ...this.stats, byKey: { ...this.stats.byKey } });
  }

  executeQuery<T>(
    query: string,
    variables?: any,
    options?: { policy?: Policy; ttlMs?: number; allowServerFetch?: boolean }
  ): Observable<T> {
    const policy = options?.policy ?? 'cache-first';
    const ttl = options?.ttlMs ?? DEFAULT_TTL_MS;
    const allowServerFetch = options?.allowServerFetch ?? false;

    const q = normalizeQuery(query);
    const key = this.key(q, variables);

    if (!isBrowser && !allowServerFetch) {
      const cached = this.memory.get(key);
      if (cached) return of(cached.data as T);
      return of(undefined as unknown as T);
    }

    const cached = this.memory.get(key);
    const fresh = !!cached && Date.now() - cached.ts < ttl;

    if (policy !== 'network-only' && fresh) {
      if (policy === 'cache-and-network') this.refresh(key, q, variables);
      return of(cached!.data as T);
    }

    return this.fetchAndCache<T>(key, q, variables, 'NETWORK');
  }

  executeMutation<T>(mutation: string, variables?: any): Observable<T> {
    const m = normalizeQuery(mutation);
    return from(this.doRequest<T>(m, variables, 'NETWORK (mutation)'))
      .pipe(shareReplay({ bufferSize: 1, refCount: true }));
  }

  private fetchAndCache<T>(key: string, doc: string, vars: any, tag: string): Observable<T> {
    if (this.inFlight.has(key)) return this.inFlight.get(key) as Observable<T>;

    const req$ = from(this.doRequest<T>(doc, vars, tag)).pipe(
      tap(data => {
        if (this.memory.size >= MAX_MEMORY_ENTRIES) {
          const first = this.memory.keys().next().value as string | undefined;
          if (first) this.memory.delete(first);
        }
        this.memory.set(key, { data, ts: Date.now() });
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.inFlight.set(key, req$);
    req$.subscribe({
      complete: () => this.inFlight.delete(key),
      error: () => this.inFlight.delete(key),
    });

    return req$;
  }

  private refresh(key: string, doc: string, vars?: any) {
    this.fetchAndCache(key, doc, vars, 'NETWORK (refresh)').subscribe({ error: () => { } });
  }

  private async doRequest<T>(doc: string, vars: any, tag: string): Promise<T> {
    const key = this.key(doc, vars);
    this.record(key, tag);
    try {
      return await request<T>(this.endpoint, doc, vars);
    } catch (e) {
      if (isAbort(e)) throw new Error('Request aborted');
      throw toError(e);
    }
  }

  private key(doc: string, variables?: any) {
    return JSON.stringify({ q: doc, v: stableStringify(variables ?? {}) });
  }

  private record(key: string, tag: string) {
    const now = Date.now();
    this.stats.total += 1;
    this.stats.byKey[key] = (this.stats.byKey[key] ?? 0) + 1;
    this.lastMinuteQueue.push(now);
    while (this.lastMinuteQueue.length && now - this.lastMinuteQueue[0] > 60_000) this.lastMinuteQueue.shift();
    this.stats.lastMinute = this.lastMinuteQueue.length;
    if (isBrowser) console.log(`[GQL] ${tag} #${this.stats.byKey[key]} :: ${key}`);
  }
}

export { gql } from 'graphql-request';
