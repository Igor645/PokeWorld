/** Pure helpers for Pokéle: the attributes each guess is compared on, the comparison itself, and the daily seed. */

export type Verdict = 'ok' | 'part' | 'no';
export type TileKey = 'gen' | 'type' | 'color' | 'stage' | 'height' | 'weight' | 'cls';

export interface Attr {
  id: number;
  gen: number;
  types: string[];
  color: string;
  habitat: string;
  shape: string;
  eggs: string[];
  stage: number;
  /** decimetres / hectograms, as PokeAPI stores them */
  height: number;
  weight: number;
  cls: 'Regular' | 'Baby' | 'Legendary' | 'Mythical';
}

export interface Tile {
  key: TileKey;
  verdict: Verdict;
  /** which way the answer lies for numeric columns */
  dir: 'up' | 'down' | null;
}

export const TILE_KEYS: TileKey[] = ['gen', 'type', 'color', 'stage', 'height', 'weight', 'cls'];

export const TILE_LABEL: Record<TileKey, string> = {
  gen: 'Gen', type: 'Type', color: 'Color', stage: 'Stage', height: 'Height', weight: 'Weight', cls: 'Class',
};

export const TYPE_COLORS: Record<string, string> = {
  normal: '#B9B9AA', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C', grass: '#7AC74C', ice: '#96D9D6',
  fighting: '#C22E28', poison: '#A33EA1', ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
  rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746', steel: '#B7B7CE', fairy: '#D685AD',
};

/** Turns the raw PokeAPI rows into attributes, working out each species' stage in its evolution line. */
export function buildAttrs(rows: any[]): Map<number, Attr> {
  const parent = new Map<number, number | null>(rows.map(r => [r.id, r.evolves_from_species_id ?? null]));
  const stageOf = (id: number): number => {
    let n = 1;
    let p = parent.get(id) ?? null;
    while (p && n < 6) { n++; p = parent.get(p) ?? null; }
    return n;
  };
  const out = new Map<number, Attr>();
  for (const r of rows) {
    const p = r.pokemons?.[0];
    out.set(r.id, {
      id: r.id,
      gen: r.generation_id ?? 0,
      types: (p?.pokemontypes ?? []).map((t: any) => t.type.name),
      color: r.pokemoncolor?.name ?? '?',
      habitat: r.pokemonhabitat?.name ?? '',
      shape: r.pokemonshape?.name ?? '',
      eggs: (r.pokemonegggroups ?? []).map((e: any) => e.egggroup.name),
      stage: stageOf(r.id),
      height: p?.height ?? 0,
      weight: p?.weight ?? 0,
      cls: r.is_mythical ? 'Mythical' : r.is_legendary ? 'Legendary' : r.is_baby ? 'Baby' : 'Regular',
    });
  }
  return out;
}

const near = (a: number, b: number): boolean => Math.abs(a - b) <= Math.max(a, b) * 0.2;

function numeric(key: TileKey, guess: number, target: number, close: boolean): Tile {
  if (guess === target) return { key, verdict: 'ok', dir: null };
  return { key, verdict: close && near(guess, target) ? 'part' : 'no', dir: target > guess ? 'up' : 'down' };
}

/** How a guess compares with the answer, column by column. */
export function compare(g: Attr, t: Attr): Tile[] {
  const sameTypes = g.types.length === t.types.length && g.types.every(x => t.types.includes(x));
  const sharedType = g.types.some(x => t.types.includes(x));
  return [
    numeric('gen', g.gen, t.gen, false),
    { key: 'type', verdict: sameTypes ? 'ok' : sharedType ? 'part' : 'no', dir: null },
    { key: 'color', verdict: g.color === t.color ? 'ok' : 'no', dir: null },
    numeric('stage', g.stage, t.stage, false),
    numeric('height', g.height, t.height, true),
    numeric('weight', g.weight, t.weight, true),
    { key: 'cls', verdict: g.cls === t.cls ? 'ok' : 'no', dir: null },
  ];
}

/** One character per column: g = match, y = close, n = no. Used for the share text and the live scoreboard. */
export function pattern(tiles: Tile[]): string {
  return tiles.map(t => (t.verdict === 'ok' ? 'g' : t.verdict === 'part' ? 'y' : 'n')).join('');
}

export const EMOJI: Record<string, string> = { g: '🟩', y: '🟨', n: '⬛' };

// ── daily seed ───────────────────────────────────────────────────────────────────

export function dayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Small string hash (xmur3) so everybody gets the same Pokémon on the same date. */
export function hashString(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ') : '—';
}
