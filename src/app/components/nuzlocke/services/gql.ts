import { environment } from '../../../../environments/environment';

/** Small POST helper with backoff. Kept separate from the app-wide GraphQLService so large one-off
 *  catalogue queries never pollute its shared response cache. */
export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(environment.apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.errors?.length) throw new Error(json.errors[0].message);
      return json.data as T;
    } catch (e) {
      last = e;
      await new Promise(r => setTimeout(r, 500 * (attempt + 1) ** 2));
    }
  }
  throw last;
}

export function readJson<T>(key: string): T | null {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}

export function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}
