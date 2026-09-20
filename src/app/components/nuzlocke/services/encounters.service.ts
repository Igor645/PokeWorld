import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { areaKey } from '../models';
import { GAME_VERSIONS } from '../nuzlocke-data';
import { ENCOUNTER_OVERRIDES } from '../encounter-overrides';
import { gql, readJson, writeJson } from './gql';
import { PokedexService } from './pokedex.service';

export interface AreaMon { slug: string; methods: string[]; min: number; max: number; version?: string; }
export interface AreaState {
  status: 'loading' | 'ready' | 'empty';
  mons: AreaMon[];
  /** True when the rows come from the bundled Bulbapedia supplement instead of PokeAPI. */
  supplemented: boolean;
}

// loc: locationId -> [pokemonId, minLevel, maxLevel, methodBitmask][]
interface GameEnc { t: number; methods: string[]; loc: Record<number, number[][]>; }

const ENC_KEY = (game: string) => `pw-nz-enc-v1-${game}`;
const TTL = 21 * 24 * 3600 * 1000;

@Injectable({ providedIn: 'root' })
export class EncounterService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly dex = inject(PokedexService);

  private readonly games = signal<Record<string, GameEnc | 'loading'>>({});

  /** One request per game, cached for three weeks. Replaces the old per-route lookups. */
  requestGame(game: string): void {
    const versions = GAME_VERSIONS[game];
    if (!this.browser || !versions || this.games()[game]) return;
    const cached = readJson<GameEnc>(ENC_KEY(game));
    if (cached && Date.now() - cached.t < TTL) {
      this.games.update(g => ({ ...g, [game]: cached }));
      return;
    }
    this.games.update(g => ({ ...g, [game]: 'loading' }));
    void gql<{ encounter: { pokemon_id: number; min_level: number; max_level: number; locationarea: { location_id: number }; encounterslot: { encountermethod: { name: string } } }[] }>(
      `query($v:[String!]) { encounter(where:{version:{name:{_in:$v}}}) {
         pokemon_id min_level max_level locationarea { location_id } encounterslot { encountermethod { name } } } }`, { v: versions },
    ).then(d => {
      const methods: string[] = [];
      const acc = new Map<number, Map<number, number[]>>();
      for (const e of d.encounter) {
        const m = e.encounterslot.encountermethod.name;
        let bit = methods.indexOf(m);
        if (bit < 0) bit = methods.push(m) - 1;
        const loc = acc.get(e.locationarea.location_id) ?? new Map<number, number[]>();
        const row = loc.get(e.pokemon_id) ?? [e.pokemon_id, e.min_level, e.max_level, 0];
        row[1] = Math.min(row[1], e.min_level);
        row[2] = Math.max(row[2], e.max_level);
        row[3] |= 1 << bit;
        loc.set(e.pokemon_id, row);
        acc.set(e.locationarea.location_id, loc);
      }
      const data: GameEnc = { t: Date.now(), methods, loc: {} };
      for (const [id, rows] of acc) data.loc[id] = [...rows.values()];
      writeJson(ENC_KEY(game), data);
      this.games.update(g => ({ ...g, [game]: data }));
    }).catch(() => this.games.update(g => { const { [game]: _, ...rest } = g; return rest; }));
  }

  /** Pure read of what is known about an area. PokeAPI first; the bundled supplement fills areas it has no rows for. */
  area(game: string, area: string): AreaState {
    const g = this.games()[game];
    if (!g || g === 'loading' || !this.dex.packReady()) return { status: 'loading', mons: [], supplemented: false };

    const loc = this.dex.location(game, area);
    const rows = loc ? (g.loc[loc[1]] ?? []) : [];
    const mons: AreaMon[] = rows
      .map(([pid, min, max, mask]) => ({
        slug: this.dex.slugOfPokemon(pid), min, max,
        methods: g.methods.filter((_, i) => mask & (1 << i)).map(m => m.replace(/-/g, ' ')),
      }))
      .filter(m => m.slug)
      .sort((a, b) => (this.dex.speciesId(a.slug) ?? 0) - (this.dex.speciesId(b.slug) ?? 0));
    if (mons.length) return { status: 'ready', mons, supplemented: false };

    const extra = ENCOUNTER_OVERRIDES[game]?.[area];
    if (!extra) return { status: 'empty', mons: [], supplemented: false };
    return {
      status: 'ready', supplemented: true,
      mons: extra.map(([slug, min, max, methods, version]) => ({ slug, min, max, methods: methods.split(' · '), version: version || undefined }))
        .sort((a, b) => (this.dex.speciesId(a.slug) ?? 0) - (this.dex.speciesId(b.slug) ?? 0)),
    };
  }
}
