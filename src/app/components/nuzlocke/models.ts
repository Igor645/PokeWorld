import { GAMES, Milestone } from './nuzlocke-data';

export const STORAGE_V1 = 'pw-nuzlocke-v1';
export const STORAGE_V2 = 'pw-nuzlocke-v2';

export type Mode = 'solo' | 'soullink';
export type PlayerId = 'p1' | 'p2';
export type Outcome = 'caught' | 'failed' | 'dupe' | 'skipped';
export type Slot = 'party' | 'box' | 'grave';
export type LinkState = 'solo' | 'none' | 'pending' | 'linked' | 'void';

export interface Encounter {
  species: string;      // PokeAPI slug, '' when nothing was caught
  outcome: Outcome;
  nickname: string;
  level: number;
  slot: Slot;           // only meaningful for outcome === 'caught'
  cause?: string;       // what killed it
  diedAt?: string;      // where the run was when it died
  shiny?: boolean;
  ability?: string;     // ability slug the Pokémon has
  item?: string;        // held item, free text
  moves?: string;       // free text, e.g. "Tackle, Growl, Bite"
  note?: string;
}

export type JournalKind = 'catch' | 'miss' | 'death' | 'boss' | 'evolve' | 'note' | 'other';
export interface JournalEntry { t: number; kind: JournalKind; text: string; }

export interface Rules {
  dupesClause: boolean;   // duplicates don't count as the area's encounter
  shinyClause: boolean;   // shinies may always be caught
  levelCaps: boolean;     // warn when a Pokémon outlevels the next boss
  linkedDeath: boolean;   // soullink: partner dies with you
  voidOnMiss: boolean;    // soullink: partner is unusable if you missed your catch
  pairedParty: boolean;   // soullink: moving one member between party and box moves its partner too
  formsSeparate: boolean; // Alolan / Galarian / Hisuian / Paldean forms are their own line for the dupes clause
}

export interface BossState { defeated: boolean; cap?: number; }

export type AreaLog = Partial<Record<PlayerId, Encounter>>;

export interface Run {
  v: 2;
  id: string;
  name: string;
  game: string;
  mode: Mode;
  p1Name: string;
  p2Name: string;
  isRandomizer: boolean;
  rules: Rules;
  createdAt: number;
  updatedAt: number;
  customAreas: string[];
  areas: Record<string, AreaLog>;
  bosses: Record<string, BossState>;
  journal: JournalEntry[];
  /** Present once the run is shared for live co-editing. */
  share?: { key: string };
  /** Per-cell edit times, used to merge two copies (see sync.ts). */
  stamps?: Record<string, number>;
}

export type Step =
  | { kind: 'area'; key: string; name: string }
  | { kind: 'boss'; key: string; boss: Milestone };

export interface RulePreset { id: string; label: string; blurb: string; rules: Rules; }

export const RULE_PRESETS: RulePreset[] = [
  {
    id: 'classic', label: 'Classic',
    blurb: 'First encounter per area, dupes and shinies excepted. No level cap.',
    rules: { dupesClause: true, shinyClause: true, levelCaps: false, linkedDeath: true, voidOnMiss: true, pairedParty: true, formsSeparate: true },
  },
  {
    id: 'hardcore', label: 'Hardcore',
    blurb: 'Classic plus level caps: nothing may outlevel the next boss.',
    rules: { dupesClause: true, shinyClause: true, levelCaps: true, linkedDeath: true, voidOnMiss: true, pairedParty: true, formsSeparate: true },
  },
  {
    id: 'purist', label: 'Purist',
    blurb: 'No clauses at all. Whatever you meet first is what you get.',
    rules: { dupesClause: false, shinyClause: false, levelCaps: true, linkedDeath: true, voidOnMiss: true, pairedParty: true, formsSeparate: true },
  },
];

export const RULE_LABELS: Record<keyof Rules, { label: string; hint: string; soulOnly?: boolean }> = {
  dupesClause: { label: 'Dupes clause', hint: 'If the first encounter is a species you already own, it is skipped and you may try again.' },
  shinyClause: { label: 'Shiny clause', hint: 'Shiny Pokémon can be caught regardless of what the area gave you.' },
  formsSeparate: { label: 'Regional forms are separate', hint: 'Alolan, Galarian, Hisuian and Paldean forms count as their own line for the dupes clause (Rattata and Alolan Rattata are different).' },
  levelCaps:   { label: 'Level caps', hint: 'Flags Pokémon that are above the level of the next undefeated boss.' },
  linkedDeath: { label: 'Linked death', hint: 'When one soul-linked Pokémon dies its partner is marked dead too.', soulOnly: true },
  voidOnMiss:  { label: 'Void on miss', hint: 'If one player fails to catch, the other player\'s catch from that area becomes unusable.', soulOnly: true },
  pairedParty: { label: 'Paired party', hint: 'Moving a Pokémon between party and box moves its soul-link partner along with it.', soulOnly: true },
};

export const LANGUAGES: { id: number; label: string }[] = [
  { id: 9, label: 'English' }, { id: 5, label: 'Français' }, { id: 6, label: 'Deutsch' }, { id: 7, label: 'Español' },
  { id: 8, label: 'Italiano' }, { id: 11, label: '日本語' }, { id: 3, label: '한국어' }, { id: 12, label: '简体中文' }, { id: 4, label: '繁體中文' },
];

export function areaKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export function formatName(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** The game's areas, followed by any bonus encounters the player added (gifts, statics, trades…). */
export function areaNames(run: Pick<Run, 'game' | 'customAreas'>): string[] {
  return run.game === 'custom' ? run.customAreas : [...(GAMES[run.game]?.routes ?? []), ...run.customAreas];
}

export function bossesOf(run: Pick<Run, 'game'>): Milestone[] {
  return GAMES[run.game]?.milestones ?? [];
}

export function buildSteps(run: Pick<Run, 'game' | 'customAreas'>): Step[] {
  const bosses = bossesOf(run);
  const placed = new Set<string>();
  const steps: Step[] = [];
  for (const name of areaNames(run)) {
    steps.push({ kind: 'area', key: areaKey(name), name });
    for (const b of bosses.filter(m => m.afterRoute === name)) {
      steps.push({ kind: 'boss', key: b.name, boss: b });
      placed.add(b.name);
    }
  }
  for (const b of bosses) if (!placed.has(b.name)) steps.push({ kind: 'boss', key: b.name, boss: b });
  return steps;
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Type chart ───────────────────────────────────────────────────────────────

export const ALL_TYPES = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
  'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'] as const;

export const TYPE_COLORS: Record<string, string> = {
  normal: '#9099A1', fire: '#FF9C54', water: '#4D90D5', electric: '#F3D23B', grass: '#63BB5B', ice: '#74CEC0',
  fighting: '#CE4069', poison: '#AB6AC8', ground: '#D97846', flying: '#89AAE3', psychic: '#F97176', bug: '#91C12F',
  rock: '#C5B78C', ghost: '#5269AC', dragon: '#0A6DC4', dark: '#5A5366', steel: '#5A8EA1', fairy: '#EC8FE6',
};

const TYPE_CHART: Record<string, { weak: string[]; resist: string[]; immune: string[] }> = {
  normal:   { weak: ['fighting'], resist: [], immune: ['ghost'] },
  fire:     { weak: ['water', 'ground', 'rock'], resist: ['fire', 'grass', 'ice', 'bug', 'steel', 'fairy'], immune: [] },
  water:    { weak: ['electric', 'grass'], resist: ['fire', 'water', 'ice', 'steel'], immune: [] },
  electric: { weak: ['ground'], resist: ['electric', 'flying', 'steel'], immune: [] },
  grass:    { weak: ['fire', 'ice', 'poison', 'flying', 'bug'], resist: ['water', 'electric', 'grass', 'ground'], immune: [] },
  ice:      { weak: ['fire', 'fighting', 'rock', 'steel'], resist: ['ice'], immune: [] },
  fighting: { weak: ['flying', 'psychic', 'fairy'], resist: ['bug', 'rock', 'dark'], immune: [] },
  poison:   { weak: ['ground', 'psychic'], resist: ['grass', 'fighting', 'poison', 'bug', 'fairy'], immune: [] },
  ground:   { weak: ['water', 'grass', 'ice'], resist: ['poison', 'rock'], immune: ['electric'] },
  flying:   { weak: ['electric', 'ice', 'rock'], resist: ['grass', 'fighting', 'bug'], immune: ['ground'] },
  psychic:  { weak: ['bug', 'ghost', 'dark'], resist: ['fighting', 'psychic'], immune: [] },
  bug:      { weak: ['fire', 'flying', 'rock'], resist: ['grass', 'fighting', 'ground'], immune: [] },
  rock:     { weak: ['water', 'grass', 'fighting', 'ground', 'steel'], resist: ['normal', 'fire', 'poison', 'flying'], immune: [] },
  ghost:    { weak: ['ghost', 'dark'], resist: ['poison', 'bug'], immune: ['normal', 'fighting'] },
  dragon:   { weak: ['ice', 'dragon', 'fairy'], resist: ['fire', 'water', 'electric', 'grass'], immune: [] },
  dark:     { weak: ['fighting', 'bug', 'fairy'], resist: ['ghost', 'dark'], immune: ['psychic'] },
  steel:    { weak: ['fire', 'fighting', 'ground'], resist: ['normal', 'grass', 'ice', 'flying', 'psychic', 'bug', 'rock', 'dragon', 'steel', 'fairy'], immune: ['poison'] },
  fairy:    { weak: ['poison', 'steel'], resist: ['fighting', 'bug', 'dark'], immune: ['dragon'] },
};

/** Damage multiplier of every attacking type against a defender with the given types. */
export function matchups(defTypes: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const t of ALL_TYPES) m[t] = 1;
  for (const d of defTypes) {
    const c = TYPE_CHART[d];
    if (!c) continue;
    for (const t of c.weak) m[t] *= 2;
    for (const t of c.resist) m[t] *= 0.5;
    for (const t of c.immune) m[t] = 0;
  }
  return m;
}

// ── v1 → v2 migration ────────────────────────────────────────────────────────

interface V1Enc {
  pokemon: string; nickname?: string; status: 'alive' | 'dead' | 'skip' | 'denied';
  level?: number; inParty?: boolean; killedBy?: string;
}
interface V1Run {
  id: string; name: string; game: string; mode: 'nuzlocke' | 'soullink'; p1Name: string; p2Name: string;
  isRandomizer?: boolean; createdAt: number; customRoutes?: string[];
  encounters: Record<string, { p1?: V1Enc; p2?: V1Enc }>;
  defeatedMilestones?: string[]; milestoneOverrides?: Record<string, number>;
}

function migrateEnc(e: V1Enc, area: string): Encounter {
  const base = { species: e.pokemon ?? '', nickname: e.nickname ?? '', level: e.level ?? 0 };
  switch (e.status) {
    case 'alive':  return { ...base, outcome: 'caught', slot: e.inParty === false ? 'box' : 'party' };
    case 'dead':   return { ...base, outcome: 'caught', slot: 'grave', cause: e.killedBy, diedAt: area };
    case 'skip':   return { ...base, species: '', outcome: 'skipped', slot: 'box', level: 0 };
    default:       return { ...base, species: '', outcome: 'dupe', slot: 'box', level: 0 };
  }
}

export function migrateV1(raw: unknown): Run[] {
  if (!Array.isArray(raw)) return [];
  return (raw as V1Run[]).map(r => {
    const mode: Mode = r.mode === 'soullink' ? 'soullink' : 'solo';
    const names = r.game === 'custom' ? (r.customRoutes ?? []) : (GAMES[r.game]?.routes ?? []);
    const nameByKey = new Map(names.map(n => [areaKey(n), n]));
    const areas: Record<string, AreaLog> = {};
    for (const [key, pair] of Object.entries(r.encounters ?? {})) {
      const area = nameByKey.get(key) ?? key;
      const log: AreaLog = {};
      if (pair.p1) log.p1 = migrateEnc(pair.p1, area);
      if (pair.p2) log.p2 = migrateEnc(pair.p2, area);
      areas[key] = log;
    }
    const bosses: Record<string, BossState> = {};
    for (const n of r.defeatedMilestones ?? []) bosses[n] = { defeated: true };
    for (const [n, cap] of Object.entries(r.milestoneOverrides ?? {})) bosses[n] = { defeated: bosses[n]?.defeated ?? false, cap };
    return {
      v: 2 as const, id: r.id, name: r.name, game: r.game, mode,
      p1Name: r.p1Name || 'Player 1', p2Name: mode === 'soullink' ? (r.p2Name || 'Player 2') : '',
      isRandomizer: !!r.isRandomizer, rules: { ...RULE_PRESETS[0].rules },
      createdAt: r.createdAt, updatedAt: r.createdAt,
      customAreas: r.customRoutes ?? [], areas, bosses, journal: [],
    };
  });
}
