import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SettingsService } from '../../../services/settings.service';
import { areaKey, formatName } from '../models';
import { GAMES, GAME_VERSIONS } from '../nuzlocke-data';
import { gql, readJson, writeJson } from './gql';

export interface BaseStats { hp: number; atk: number; def: number; spa: number; spd: number; spe: number; }
export interface SpeciesInfo {
  slug: string; id: number; types: string[]; abilities: { slug: string; hidden: boolean }[]; stats: BaseStats;
}

// [speciesId, slug, evolutionChainId, evolvesFromSpeciesId(0 = none)] and [pokemonId, slug, speciesId, isDefault]
interface Struct { species: [number, string, number, number][]; pokemon: [number, string, number, number][]; }
// Language pack: species names, type names, ability names, locations (slug -> [id, name]), version names.
interface Pack { s: Record<number, string>; t: Record<string, string>; a: Record<string, string>; l: Record<string, [number, string]>; v: Record<string, string>; }

const STRUCT_KEY = 'pw-nz-struct-v1';
const PACK_KEY = (lang: number) => `pw-nz-pack-v1-${lang}`;
const SPECIES_KEY = 'pw-nz-species-v2';
const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const NUMBER_WORDS: Record<string, string> = { '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six' };
const REGION_TOKEN = /-(alola|galar|hisui|paldea)(?:-|$)/;
const REGION_ADJ: Record<string, string> = { alola: 'Alolan', galar: 'Galarian', hisui: 'Hisuian', paldea: 'Paldean' };
/** Evolutions that only exist for a regional form of their pre-evolution. */
const REGIONAL_ONLY: Record<string, string> = {
  perrserker: 'galar', sirfetchd: 'galar', 'mr-rime': 'galar', cursola: 'galar', runerigus: 'galar', obstagoon: 'galar',
  overqwil: 'hisui', sneasler: 'hisui', clodsire: 'paldea',
};
/** Transformations and event forms: they differ from the base form but can't be encountered or caught as such. */
const NOT_ENCOUNTERABLE = /^(rotom-|shaymin-|kyurem-|hoopa-|floette-eternal|minior-|necrozma-|zygarde-|calyrex-|ogerpon-)|-(gmax|totem|eternamax|starter|cap|busted|school|power-construct|mega|primal|origin|complete|ash|bloodmoon)(-|$)/;
const FORMS_KEY = 'pw-nz-forms-v2';
const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

@Injectable({ providedIn: 'root' })
export class PokedexService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly languageId = signal(9);
  /** Mirrors the app-wide sprite settings (Settings panel). */
  readonly spriteStyle = signal<'pixel' | 'home' | 'sugimori'>('sugimori');
  readonly animated = signal(false);

  private readonly struct = signal<Struct | null>(null);
  private readonly pack = signal<Pack | null>(null);
  readonly ready = computed(() => !!this.struct());
  readonly packReady = computed(() => !!this.pack());
  private readonly slugById = computed(() => new Map(this.struct()?.pokemon.map(p => [p[0], p[1]]) ?? []));

  private readonly pokeId = computed(() => new Map(this.struct()?.pokemon.map(p => [p[1], p[0]]) ?? []));
  private readonly speciesOfPoke = computed(() => new Map(this.struct()?.pokemon.map(p => [p[1], p[2]]) ?? []));
  private readonly speciesSlug = computed(() => new Map(this.struct()?.species.map(s => [s[0], s[1]]) ?? []));
  private readonly chainOfSpecies = computed(() => new Map(this.struct()?.species.map(s => [s[0], s[2]]) ?? []));
  private readonly defaultPoke = computed(() => new Map(this.struct()?.pokemon.filter(p => p[3]).map(p => [p[2], p[1]]) ?? []));
  private readonly evolvesInto = computed(() => {
    const m = new Map<number, number[]>();
    for (const s of this.struct()?.species ?? []) if (s[3]) m.set(s[3], [...(m.get(s[3]) ?? []), s[0]]);
    return m;
  });

  /** Forms worth telling apart: catchable, and different from the base form in typing or base stats. */
  private readonly notable = signal<Set<string>>(new Set());

  private readonly speciesCache = signal<Record<string, SpeciesInfo>>({});
  private readonly inflight = new Set<string>();
  private pending = new Set<string>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly evo = signal<Record<number, string>>({});
  private readonly evoLevel = signal<Record<number, number>>({});
  private readonly locationMemo = new Map<string, [string, number] | null>();

  constructor() {
    if (!this.browser) return;
    for (const old of ['pw-nz-names-v1', 'pw-nz-species-v1', 'pw-nz-areas-v1', 'pw-nz-locations-v1']) {
      try { localStorage.removeItem(old); } catch { /* ignore */ }
    }
    this.speciesCache.set(readJson(SPECIES_KEY) ?? {});
    void this.loadStruct();
    void this.loadForms();
    const settings = inject(SettingsService);
    settings.watchSetting<number>('selectedLanguageId').subscribe(id => this.setLanguage(id ?? 9));
    settings.watchSetting<string>('spriteStyle').subscribe(v => this.spriteStyle.set((v as 'pixel' | 'home' | 'sugimori') || 'sugimori'));
    settings.watchSetting<boolean>('pixelAnimated').subscribe(v => this.animated.set(!!v));
  }

  // ── catalogue loading ──────────────────────────────────────────────────────

  private async loadStruct(): Promise<void> {
    let s = readJson<Struct>(STRUCT_KEY);
    if (!s) {
      try {
        const d = await gql<{
          pokemonspecies: { id: number; name: string; evolution_chain_id: number; evolves_from_species_id: number | null }[];
          pokemon: { id: number; name: string; pokemon_species_id: number; is_default: boolean }[];
        }>(`{ pokemonspecies(order_by:{id:asc}) { id name evolution_chain_id evolves_from_species_id }
              pokemon(order_by:{id:asc}) { id name pokemon_species_id is_default } }`);
        s = {
          species: d.pokemonspecies.map(x => [x.id, x.name, x.evolution_chain_id, x.evolves_from_species_id ?? 0]),
          pokemon: d.pokemon.map(x => [x.id, x.name, x.pokemon_species_id, x.is_default ? 1 : 0]),
        };
        writeJson(STRUCT_KEY, s);
      } catch { return; }
    }
    this.struct.set(s);
  }

  private async loadForms(): Promise<void> {
    const cached = readJson<string[]>(FORMS_KEY);
    if (cached) { this.notable.set(new Set(cached)); return; }
    try {
      const d = await gql<{
        forms: { name: string; pokemon_species_id: number; pokemontypes: { type_id: number }[]; pokemonstats: { base_stat: number }[]; pokemonforms: { is_battle_only: boolean; is_mega: boolean }[] }[];
        base: { pokemon_species_id: number; pokemontypes: { type_id: number }[]; pokemonstats: { base_stat: number }[] }[];
      }>(`{ forms: pokemon(where:{is_default:{_eq:false}}) { name pokemon_species_id pokemontypes(order_by:{slot:asc}) { type_id } pokemonstats { base_stat } pokemonforms { is_battle_only is_mega } }
            base: pokemon(where:{is_default:{_eq:true}}) { pokemon_species_id pokemontypes(order_by:{slot:asc}) { type_id } pokemonstats { base_stat } } }`);
      const sig = (p: { pokemontypes: { type_id: number }[] }) => p.pokemontypes.map(t => t.type_id).join('-');
      const bst = (p: { pokemonstats: { base_stat: number }[] }) => p.pokemonstats.reduce((a, x) => a + x.base_stat, 0);
      const base = new Map(d.base.map(b => [b.pokemon_species_id, b]));
      const keep = d.forms.filter(f => {
        const b = base.get(f.pokemon_species_id);
        return !!b && !f.pokemonforms.some(x => x.is_battle_only || x.is_mega) && !NOT_ENCOUNTERABLE.test(f.name)
          && (sig(f) !== sig(b) || bst(f) !== bst(b));
      }).map(f => f.name);
      writeJson(FORMS_KEY, keep);
      this.notable.set(new Set(keep));
    } catch { /* names still work without it, only the form list is missing */ }
  }

  setLanguage(id: number): void {
    this.languageId.set(id);
    this.locationMemo.clear();
    void this.loadPack(id);
  }

  private async loadPack(lang: number): Promise<void> {
    let p = readJson<Pack>(PACK_KEY(lang));
    if (!p) {
      try {
        const d = await gql<{
          pokemonspeciesname: { pokemon_species_id: number; name: string }[];
          type: { name: string; typenames: { name: string }[] }[];
          ability: { name: string; abilitynames: { name: string }[] }[];
          location: { id: number; name: string; locationnames: { name: string }[] }[];
          version: { name: string; versionnames: { name: string }[] }[];
        }>(`query($l:Int!) {
              pokemonspeciesname(where:{language_id:{_eq:$l}}) { pokemon_species_id name }
              type(where:{id:{_lt:100}}) { name typenames(where:{language_id:{_eq:$l}}) { name } }
              ability { name abilitynames(where:{language_id:{_eq:$l}}) { name } }
              location { id name locationnames(where:{language_id:{_eq:$l}}) { name } }
              version { name versionnames(where:{language_id:{_eq:$l}}) { name } } }`, { l: lang });
        p = { s: {}, t: {}, a: {}, l: {}, v: {} };
        for (const x of d.pokemonspeciesname) p.s[x.pokemon_species_id] = x.name;
        for (const x of d.type) if (x.typenames[0]) p.t[x.name] = x.typenames[0].name;
        for (const x of d.ability) if (x.abilitynames[0]) p.a[x.name] = x.abilitynames[0].name;
        for (const x of d.location) p.l[x.name] = [x.id, x.locationnames[0]?.name ?? ''];
        for (const x of d.version) if (x.versionnames[0]) p.v[x.name] = x.versionnames[0].name;
        writeJson(PACK_KEY(lang), p);
      } catch { return; }
    }
    if (this.languageId() === lang) this.pack.set(p);
  }

  // ── names ──────────────────────────────────────────────────────────────────

  displayName(slug: string): string {
    const sid = this.speciesOfPoke().get(slug);
    const pack = this.pack();
    if (!sid || !pack) return formatName(slug);
    const base = pack.s[sid] ?? formatName(this.speciesSlug().get(sid) ?? slug);
    if (this.defaultPoke().get(sid) === slug) return base;
    return `${base} (${this.formLabel(slug)})`;
  }

  /** "Alolan", "Galarian", "Paldean · Combat Breed", "Sandy"… empty for a base form. */
  formLabel(slug: string): string {
    const sid = this.speciesOfPoke().get(slug);
    if (!sid || this.defaultPoke().get(sid) === slug) return '';
    const root = this.speciesSlug().get(sid) ?? '';
    const tokens = (slug.startsWith(root + '-') ? slug.slice(root.length + 1) : slug).split('-');
    const words = tokens.map(t => REGION_ADJ[t] ?? formatName(t));
    return REGION_ADJ[tokens[0]] && words.length > 1 ? `${words[0]} · ${words.slice(1).join(' ')}` : words.join(' ');
  }

  /** Other forms of the same species that are worth telling apart (regional forms, Oricorio styles…). */
  formsOf(slug: string): string[] {
    const sid = this.speciesOfPoke().get(slug);
    if (!sid) return [];
    const all = [this.defaultPoke().get(sid) ?? '', ...[...this.notable()].filter(f => this.speciesOfPoke().get(f) === sid)];
    const list = all.filter(Boolean);
    return list.length > 1 ? list.filter(f => f !== slug) : [];
  }

  isRegional(slug: string): boolean { return !!REGION_TOKEN.test(slug) || slug in REGIONAL_ONLY; }

  typeName(t: string): string { return this.pack()?.t[t] ?? formatName(t); }
  abilityName(a: string): string { return this.pack()?.a[a] ?? formatName(a); }

  gameLabel(game: string): string {
    const fallback = GAMES[game]?.name ?? 'Custom game';
    if (this.languageId() === 9) return fallback;
    const names = (GAME_VERSIONS[game] ?? []).map(v => this.pack()?.v[v]);
    return names.length && names.every(Boolean) ? names.join(' / ') : fallback;
  }

  /** Resolves one of our area names onto a PokeAPI location: [slug, id, localised name]. */
  location(game: string, area: string): [string, number, string] | null {
    const l = this.pack()?.l;
    if (!l) return null;
    const memoKey = `${game}|${area}`;
    let hit = this.locationMemo.get(memoKey);
    if (hit === undefined) {
      let slug = areaKey(area);
      if (slug.includes('-area-')) for (const [n, word] of Object.entries(NUMBER_WORDS)) slug = slug.replace(new RegExp(`-${n}$`), `-${word}`);
      const region = GAMES[game]?.locationRegion;
      const direct = [region ? `${region}-${slug}` : '', slug, region ? `${region}-sea-${slug}` : ''].filter(Boolean);
      let found = direct.find(c => l[c]);
      if (!found) {
        const keys = Object.keys(l);
        found = keys.find(k => k.endsWith('-' + slug) && (!region || k.startsWith(region))) ?? keys.find(k => k.endsWith('-' + slug));
      }
      hit = found ? [found, l[found][0]] : null;
      this.locationMemo.set(memoKey, hit);
    }
    return hit ? [hit[0], hit[1], l[hit[0]]?.[1] ?? ''] : null;
  }

  areaLabel(game: string, area: string): string {
    if (this.languageId() === 9) return area;
    return this.location(game, area)?.[2] || area;
  }

  // ── sprites + search ───────────────────────────────────────────────────────

  sprite(slug: string, shiny = false): string {
    const id = this.pokeId().get(slug);
    if (!id) return BLANK;
    const sh = shiny ? 'shiny/' : '';
    switch (this.spriteStyle()) {
      case 'home': return `${SPRITES}other/home/${sh}${id}.png`;
      case 'sugimori': return `${SPRITES}other/official-artwork/${sh}${id}.png`;
      default:
        return this.animated() && id <= 649
          ? `${SPRITES}versions/generation-v/black-white/animated/${sh}${id}.gif`
          : `${SPRITES}${sh}${id}.png`;
    }
  }

  /** Pixel art needs nearest-neighbour scaling; artwork does not. */
  readonly pixelated = computed(() => this.spriteStyle() === 'pixel');

  has(slug: string): boolean { return this.pokeId().has(slug); }

  private readonly index = computed(() => {
    const pack = this.pack();
    const notable = this.notable();
    const out: { slug: string; sid: number; hay: string }[] = [];
    for (const [, slug, sid, isDefault] of this.struct()?.pokemon ?? []) {
      if (!isDefault && !notable.has(slug)) continue;
      out.push({ slug, sid, hay: strip(pack?.s[sid] ?? '') + '|' + strip(slug) });
    }
    return out;
  });

  /** Search by localised or English name. `inside` limits results to (true) or excludes (false) the given dex. */
  search(query: string, opts: { exclude?: Set<string>; dex?: Set<number> | null; inside?: boolean; limit?: number } = {}): string[] {
    const q = strip(query);
    if (q.length < 1) return [];
    const hits: { slug: string; score: number; sid: number }[] = [];
    for (const e of this.index()) {
      if (opts.exclude?.has(e.slug)) continue;
      if (opts.dex && opts.inside !== undefined && opts.dex.has(e.sid) !== opts.inside) continue;
      const i = e.hay.indexOf(q);
      if (i < 0) continue;
      hits.push({ slug: e.slug, sid: e.sid, score: i === 0 ? 0 : (e.hay.split('|')[1].startsWith(q) ? 1 : 2) });
    }
    hits.sort((a, b) => a.score - b.score || a.sid - b.sid);
    return hits.slice(0, opts.limit ?? 30).map(h => h.slug);
  }

  // ── evolution families ─────────────────────────────────────────────────────

  chainOf(slug: string): number | undefined {
    const sid = this.speciesOfPoke().get(slug);
    return sid ? this.chainOfSpecies().get(sid) : undefined;
  }

  /** Region a Pokémon's line belongs to (Alolan, Galarian…), or undefined for the original line. */
  private regionOf(slug: string): string | undefined { return REGION_TOKEN.exec(slug)?.[1] ?? REGIONAL_ONLY[slug]; }

  /**
   * Identity of an evolution line for the dupes clause. With `separateForms`, Alolan Rattata and Rattata are
   * different lines, and Galarian Meowth's line includes Perrserker but not Persian.
   */
  lineKey(slug: string, separateForms: boolean): string {
    const chain = this.chainOf(slug);
    if (chain === undefined) return slug;
    const region = separateForms ? this.regionOf(slug) : undefined;
    return region ? `${chain}:${region}` : String(chain);
  }

  /** Name of the first stage of a Pokémon's line, e.g. Rattata for Raticate (with its region: "Rattata (Alolan)"). */
  lineName(slug: string): string {
    const chain = this.chainOf(slug);
    const first = this.struct()?.species.find(sp => sp[2] === chain && !sp[3]);
    if (!first) return this.displayName(slug);
    const region = this.regionOf(slug);
    const regional = region ? `${first[1]}-${region}` : '';
    return this.displayName(regional && this.pokeId().has(regional) ? regional : (this.defaultPoke().get(first[0]) ?? slug));
  }

  /** What a Pokémon can evolve into, respecting regional forms (Galarian Meowth -> Perrserker, never Persian). */
  evolutionsFrom(slug: string): string[] {
    const sid = this.speciesOfPoke().get(slug);
    if (!sid) return [];
    const region = REGION_TOKEN.exec(slug)?.[1];
    const out: string[] = [];
    for (const to of this.evolvesInto().get(sid) ?? []) {
      const baseSlug = this.speciesSlug().get(to) ?? '';
      const dflt = this.defaultPoke().get(to) ?? baseSlug;
      const only = REGIONAL_ONLY[dflt] ?? REGIONAL_ONLY[baseSlug];
      const variants = ['alola', 'galar', 'hisui', 'paldea'].filter(r => this.pokeId().has(`${baseSlug}-${r}`));
      if (only) { if (region !== only) continue; out.push(dflt); continue; }
      if (region) {
        if (variants.includes(region)) { out.push(`${baseSlug}-${region}`); continue; }
        if (variants.length) continue;          // e.g. Persian for a Galarian Meowth
      }
      out.push(dflt);
    }
    return out;
  }

  evolveHint(slug: string): string { return this.evo()[this.speciesOfPoke().get(slug) ?? 0] ?? ''; }

  /** Level at which a Pokémon evolves into `slug`, when that is what triggers it. */
  evolveMinLevel(slug: string): number | null { return this.evoLevel()[this.speciesOfPoke().get(slug) ?? 0] ?? null; }

  ensureEvolution(slugs: string[]): void {
    const known = this.evo();
    const ids = slugs.map(s => this.speciesOfPoke().get(s)).filter((x): x is number => !!x && !(x in known));
    if (!ids.length || !this.browser) return;
    void gql<{ pokemonevolution: { evolved_species_id: number; min_level: number | null; min_happiness: number | null; time_of_day: string; item: { name: string } | null; evolutiontrigger: { name: string } | null }[] }>(
      `query($i:[Int!]) { pokemonevolution(where:{evolved_species_id:{_in:$i}}) { evolved_species_id min_level min_happiness time_of_day item { name } evolutiontrigger { name } } }`, { i: ids },
    ).then(d => {
      const out: Record<number, string> = {};
      const lv: Record<number, number> = {};
      for (const r of d.pokemonevolution) {
        if (r.min_level) lv[r.evolved_species_id] = Math.min(lv[r.evolved_species_id] ?? 999, r.min_level);
        const parts = r.min_level ? [`Lv ${r.min_level}`] : r.item ? [`Use ${formatName(r.item.name)}`] : r.evolutiontrigger?.name === 'trade' ? ['Trade']
          : r.min_happiness ? ['Friendship'] : [formatName(r.evolutiontrigger?.name ?? 'Special')];
        if (r.time_of_day) parts.push(r.time_of_day);
        const text = parts.join(' · ');
        out[r.evolved_species_id] = out[r.evolved_species_id] && !out[r.evolved_species_id].includes(text) ? `${out[r.evolved_species_id]} / ${text}` : text;
      }
      for (const id of ids) out[id] ??= '';
      this.evo.update(c => ({ ...c, ...out }));
      this.evoLevel.update(c => ({ ...c, ...lv }));
    }).catch(() => undefined);
  }

  // ── species details ────────────────────────────────────────────────────────

  species(slug: string): SpeciesInfo | undefined { return this.speciesCache()[slug]; }

  ensure(slugs: Iterable<string>): void {
    if (!this.browser) return;
    for (const s of slugs) if (s && !this.speciesCache()[s] && !this.inflight.has(s)) { this.inflight.add(s); this.pending.add(s); }
    if (this.pending.size && !this.flushTimer) this.flushTimer = setTimeout(() => void this.flush(), 40);
  }

  private async flush(): Promise<void> {
    this.flushTimer = null;
    const batch = [...this.pending];
    this.pending.clear();
    for (let i = 0; i < batch.length; i += 80) {
      const names = batch.slice(i, i + 80);
      try {
        const d = await gql<{ pokemon: { id: number; name: string;
          pokemontypes: { type: { name: string } }[]; pokemonabilities: { is_hidden: boolean; ability: { name: string } }[];
          pokemonstats: { base_stat: number; stat: { name: string } }[] }[] }>(
          `query($n:[String!]) { pokemon(where:{name:{_in:$n}}) { id name
             pokemontypes(order_by:{slot:asc}) { type { name } }
             pokemonabilities(order_by:{slot:asc}) { is_hidden ability { name } }
             pokemonstats { base_stat stat { name } } } }`, { n: names });
        const map: Record<string, keyof BaseStats> = { hp: 'hp', attack: 'atk', defense: 'def', 'special-attack': 'spa', 'special-defense': 'spd', speed: 'spe' };
        const add: Record<string, SpeciesInfo> = {};
        for (const p of d.pokemon) {
          const stats: BaseStats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
          for (const s of p.pokemonstats) { const k = map[s.stat.name]; if (k) stats[k] = s.base_stat; }
          add[p.name] = {
            slug: p.name, id: p.id, stats,
            types: p.pokemontypes.map(t => t.type.name),
            abilities: p.pokemonabilities.map(a => ({ slug: a.ability.name, hidden: a.is_hidden })),
          };
        }
        this.speciesCache.update(c => ({ ...c, ...add }));
        writeJson(SPECIES_KEY, this.speciesCache());
      } catch { /* retried on the next ensure() */ }
      names.forEach(n => this.inflight.delete(n));
    }
  }

  speciesId(slug: string): number | undefined { return this.speciesOfPoke().get(slug); }
  slugOfPokemon(id: number): string { return this.slugById().get(id) ?? ''; }
}
