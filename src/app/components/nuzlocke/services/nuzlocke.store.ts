import { Injectable, PLATFORM_ID, computed, effect, inject, signal, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  Encounter, JournalKind, LinkState, Mode, Outcome, PlayerId, RULE_PRESETS, Rules, Run, STORAGE_V1, STORAGE_V2, Step,
  areaKey, areaNames, buildSteps, migrateV1, newId,
} from '../models';
import { readJson, writeJson } from './gql';
import { EncounterService } from './encounters.service';
import { Cell, diffCells, ensureStamps, mergeRuns, newShareKey, setCell, signature, stampCells } from '../sync';
import { Milestone } from '../nuzlocke-data';
import { PokedexService } from './pokedex.service';

export interface Entry { key: string; area: string; player: PlayerId; enc: Encounter; }
export interface CreateInput {
  name: string; game: string; mode: Mode; p1Name: string; p2Name: string; isRandomizer: boolean; rules: Rules;
}

export type PairState = 'party' | 'box' | 'split' | 'fallen' | 'half' | 'void' | 'waiting';
export interface Pair { key: string; area: string; a: Encounter | null; b: Encounter | null; state: PairState; }

interface HistoryEntry { label: string; cells: Cell[]; }

export const PARTY_SIZE = 6;
const OTHER: Record<PlayerId, PlayerId> = { p1: 'p2', p2: 'p1' };

@Injectable({ providedIn: 'root' })
export class NuzlockeStore {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly dex = inject(PokedexService);
  private readonly encounters = inject(EncounterService);

  readonly prefs = signal<{ compact: boolean }>({ compact: false });

  readonly runs = signal<Run[]>([]);
  private readonly activeId = signal<string | null>(null);
  readonly run = computed(() => this.runs().find(r => r.id === this.activeId()) ?? null);

  readonly toast = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly undoStack = signal<HistoryEntry[]>([]);
  private readonly redoStack = signal<HistoryEntry[]>([]);
  readonly canUndo = computed(() => this.undoStack().length > 0);
  readonly canRedo = computed(() => this.redoStack().length > 0);

  // ── derived ────────────────────────────────────────────────────────────────

  readonly isSoullink = computed(() => this.run()?.mode === 'soullink');
  readonly players = computed<PlayerId[]>(() => (this.isSoullink() ? ['p1', 'p2'] : ['p1']));
  readonly steps = computed<Step[]>(() => { const r = this.run(); return r ? buildSteps(r) : []; });
  readonly areaSteps = computed(() => this.steps().filter((s): s is Extract<Step, { kind: 'area' }> => s.kind === 'area'));

  readonly progress = computed(() => {
    const r = this.run();
    const areas = this.areaSteps();
    const done = r ? areas.filter(a => this.players().every(p => !!r.areas[a.key]?.[p])).length : 0;
    return { done, total: areas.length };
  });

  readonly frontier = computed<string | null>(() => {
    const r = this.run();
    if (!r) return null;
    return this.areaSteps().find(a => !this.players().every(p => !!r.areas[a.key]?.[p]))?.key ?? null;
  });

  readonly nextBoss = computed<Milestone | null>(() => {
    const r = this.run();
    if (!r) return null;
    const s = this.steps().find(x => x.kind === 'boss' && !r.bosses[x.key]?.defeated);
    return s && s.kind === 'boss' ? s.boss : null;
  });

  readonly currentCap = computed<number | null>(() => {
    const b = this.nextBoss();
    return b ? this.bossCap(b) : null;
  });

  private isVoid(r: Run, key: string, p: PlayerId): boolean {
    if (r.mode !== 'soullink' || !r.rules.voidOnMiss) return false;
    const other = r.areas[key]?.[OTHER[p]];
    return !!other && other.outcome !== 'caught';
  }

  readonly entries = computed<Entry[]>(() => {
    const r = this.run();
    if (!r) return [];
    const out: Entry[] = [];
    for (const s of this.areaSteps()) {
      for (const p of this.players()) {
        const enc = r.areas[s.key]?.[p];
        if (enc?.outcome === 'caught' && enc.species) out.push({ key: s.key, area: s.name, player: p, enc });
      }
    }
    return out;
  });

  private group(pick: (e: Entry, isVoid: boolean) => boolean): Record<PlayerId, Entry[]> {
    const r = this.run();
    const res: Record<PlayerId, Entry[]> = { p1: [], p2: [] };
    if (!r) return res;
    for (const e of this.entries()) if (pick(e, this.isVoid(r, e.key, e.player))) res[e.player].push(e);
    return res;
  }

  readonly party = computed(() => this.group((e, v) => e.enc.slot === 'party' && !v));
  readonly box = computed(() => this.group((e, v) => e.enc.slot === 'box' && !v));
  readonly grave = computed(() => this.group(e => e.enc.slot === 'grave'));
  readonly voided = computed(() => this.group((e, v) => e.enc.slot !== 'grave' && v));

  /** Soullink: every area where at least one player caught something, as a linked pair. */
  readonly pairs = computed<Pair[]>(() => {
    const r = this.run();
    if (!r || r.mode !== 'soullink') return [];
    const out: Pair[] = [];
    for (const s of this.areaSteps()) {
      const a = r.areas[s.key]?.p1?.outcome === 'caught' ? r.areas[s.key]!.p1! : null;
      const b = r.areas[s.key]?.p2?.outcome === 'caught' ? r.areas[s.key]!.p2! : null;
      if (!a && !b) continue;
      let state: PairState;
      if (a && b) {
        if (a.slot === 'grave' && b.slot === 'grave') state = 'fallen';
        else if (a.slot === 'grave' || b.slot === 'grave') state = 'half';
        else state = a.slot === b.slot ? a.slot : 'split';
      } else {
        const other = r.areas[s.key]?.[a ? 'p2' : 'p1'];
        state = other && r.rules.voidOnMiss ? 'void' : 'waiting';
      }
      out.push({ key: s.key, area: s.name, a, b, state });
    }
    return out;
  });

  readonly stats = computed(() => {
    const r = this.run();
    const count = (g: Record<PlayerId, Entry[]>) => g.p1.length + g.p2.length;
    const missed = r ? this.areaSteps().reduce((n, a) => n + this.players().filter(p => {
      const o = r.areas[a.key]?.[p]?.outcome;
      return o === 'failed';
    }).length, 0) : 0;
    const bosses = this.steps().filter(s => s.kind === 'boss');
    return {
      alive: count(this.party()) + count(this.box()),
      dead: count(this.grave()),
      voided: count(this.voided()),
      missed,
      bossesDone: r ? bosses.filter(b => r.bosses[b.key]?.defeated).length : 0,
      bossesTotal: bosses.length,
    };
  });

  constructor() {
    if (!this.browser) return;
    this.runs.set(this.load());
    effect(() => this.save(this.runs()));
    effect(() => {
      const slugs = this.entries().map(e => e.enc.species);
      untracked(() => this.dex.ensure(slugs));
    });
    this.prefs.set(readJson('pw-nz-prefs-v1') ?? { compact: false });
    effect(() => {
      const r = this.run();
      if (!r || r.game === 'custom') return;
      untracked(() => {
        if (!r.isRandomizer) this.encounters.requestGame(r.game);
      });
    });
  }

  toggleCompact(): void {
    this.prefs.update(p => ({ ...p, compact: !p.compact }));
    writeJson('pw-nz-prefs-v1', this.prefs());
  }

  // ── lookups used by the UI ─────────────────────────────────────────────────

  bossCap(b: Milestone): number { return this.run()?.bosses[b.name]?.cap ?? b.aceLevel; }
  isDefeated(name: string): boolean { return !!this.run()?.bosses[name]?.defeated; }
  encounter(key: string, p: PlayerId): Encounter | null { return this.run()?.areas[key]?.[p] ?? null; }
  playerName(p: PlayerId): string { const r = this.run(); return r ? (p === 'p1' ? r.p1Name : r.p2Name) : ''; }
  nameOf(key: string): string { return this.areaSteps().find(a => a.key === key)?.name ?? key; }
  isVoidAt(key: string, p: PlayerId): boolean { const r = this.run(); return !!r && this.isVoid(r, key, p); }

  linkState(key: string): LinkState {
    const r = this.run();
    if (!r) return 'none';
    if (r.mode === 'solo') return 'solo';
    const a = r.areas[key]?.p1;
    const b = r.areas[key]?.p2;
    if (!a && !b) return 'none';
    if (a?.outcome === 'caught' && b?.outcome === 'caught') return 'linked';
    if (a && b) return (a.outcome === 'caught' || b.outcome === 'caught') && r.rules.voidOnMiss ? 'void' : 'none';
    return 'pending';
  }

  lineKey(slug: string): string { return this.dex.lineKey(slug, this.run()?.rules.formsSeparate ?? true); }

  /** Evolution lines this player already has an encounter for (alive or dead), optionally ignoring one area. */
  ownedChains(p: PlayerId, exceptKey?: string): Set<string> {
    const out = new Set<string>();
    const r = this.run();
    if (!r) return out;
    for (const [key, log] of Object.entries(r.areas)) {
      const e = log[p];
      if (key === exceptKey || e?.outcome !== 'caught' || !e.species) continue;
      out.add(this.lineKey(e.species));
    }
    return out;
  }

  // ── run lifecycle ──────────────────────────────────────────────────────────

  open(id: string | null): boolean {
    if (this.activeId() !== id) { this.undoStack.set([]); this.redoStack.set([]); this.toast.set(null); }
    this.activeId.set(id);
    return !id || this.runs().some(r => r.id === id);
  }

  create(input: CreateInput): Run {
    const now = Date.now();
    const run: Run = {
      v: 2, id: newId(), name: input.name.trim(), game: input.game, mode: input.mode,
      p1Name: input.p1Name.trim() || 'Player 1',
      p2Name: input.mode === 'soullink' ? (input.p2Name.trim() || 'Player 2') : '',
      isRandomizer: input.isRandomizer, rules: { ...input.rules },
      createdAt: now, updatedAt: now, customAreas: [], areas: {}, bosses: {}, journal: [],
    };
    this.runs.update(l => [run, ...l]);
    return run;
  }

  remove(id: string): void {
    this.runs.update(l => l.filter(r => r.id !== id));
    if (this.activeId() === id) this.activeId.set(null);
  }

  exportJson(id: string): string {
    const run = this.runs().find(r => r.id === id);
    return JSON.stringify(run ? { ...run, share: undefined } : null, null, 2);
  }

  /** A backup of every run, without their secret share keys. */
  exportAllJson(): string {
    return JSON.stringify({ v: 2, kind: 'pokeworld-nuzlocke-backup', runs: this.runs().map(r => ({ ...r, share: undefined })) }, null, 2);
  }

  importJson(text: string): Run | null {
    try {
      const data = JSON.parse(text);
      if (data?.v === 2 && Array.isArray(data.runs)) {
        const copies = (data.runs as Run[]).filter(r => r?.name && r.game).map(r => ({ ...this.normalize(r), id: newId(), share: undefined }));
        if (!copies.length) return null;
        this.runs.update(l => [...copies, ...l]);
        this.flash(`Restored ${copies.length} run${copies.length === 1 ? '' : 's'}`);
        return copies[0];
      }
      const run: Run | undefined = Array.isArray(data) ? migrateV1(data)[0] : (data?.v === 2 ? this.normalize(data) : migrateV1([data])[0]);
      if (!run?.name || !run.game) return null;
      const copy = { ...run, id: newId(), updatedAt: Date.now(), share: undefined };
      this.runs.update(l => [copy, ...l]);
      return copy;
    } catch { return null; }
  }

  // ── history (cell based, so undo never touches what a co-editor changed) ──

  private applyCells(cur: Run, cells: Cell[], side: 'before' | 'after', label: string, verb: string): Run {
    let next = cur;
    for (const c of cells) next = setCell(next, c.key, c[side]);
    next = stampCells(next, cells.map(c => c.key), Date.now());
    return { ...next, journal: [...next.journal, { t: Date.now(), kind: 'other' as const, text: `${verb}: ${label}` }].slice(-500), updatedAt: Date.now() };
  }

  undo(): void {
    const cur = this.run();
    const entry = this.undoStack().at(-1);
    if (!cur || !entry) return;
    this.undoStack.update(s => s.slice(0, -1));
    this.redoStack.update(s => [...s, entry]);
    this.replace(this.applyCells(cur, entry.cells, 'before', entry.label, 'Undid'));
    this.flash(`Undone: ${entry.label}`);
  }

  redo(): void {
    const cur = this.run();
    const entry = this.redoStack().at(-1);
    if (!cur || !entry) return;
    this.redoStack.update(s => s.slice(0, -1));
    this.undoStack.update(s => [...s, entry]);
    this.replace(this.applyCells(cur, entry.cells, 'after', entry.label, 'Redid'));
    this.flash(`Redone: ${entry.label}`);
  }

  flash(message: string): void {
    this.toast.set(message);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 5000);
  }

  private mutate(label: string | null, fn: (r: Run) => Run | null, kind: JournalKind = 'other'): void {
    const cur = this.run();
    if (!cur) return;
    const next = fn(cur);
    if (!next || next === cur) return;
    const cells = diffCells(cur, next);
    if (cells.length) {
      this.undoStack.update(s => [...s.slice(-49), { label: label ?? 'Edit', cells }]);
      this.redoStack.set([]);
    }
    const now = Date.now();
    const journal = label ? [...next.journal, { t: now, kind, text: label }].slice(-500) : next.journal;
    this.replace({ ...stampCells(next, cells.map(c => c.key), now), journal, updatedAt: now });
    if (label) this.flash(label);
  }

  private replace(run: Run): void { this.runs.update(l => l.map(r => (r.id === run.id ? run : r))); }

  // ── live sharing ───────────────────────────────────────────────────────────

  /** Starts sharing the open run: gives it a secret key and stamps existing cells so they can be merged. */
  enableShare(): string | null {
    const r = this.run();
    if (!r) return null;
    if (r.share) return r.share.key;
    const key = newShareKey();
    this.replace({ ...ensureStamps(r), share: { key } });
    return key;
  }

  disableShare(): void {
    const r = this.run();
    if (r) this.replace({ ...r, share: undefined });
  }

  /** Merges a copy received from a co-editor (or adds the run if we have never seen it). Not undoable. */
  applyRemote(remote: Run): { id: string; added: boolean } {
    const incoming = this.normalize(ensureStamps(remote));
    const local = this.runs().find(r => r.id === incoming.id);
    if (!local) {
      this.runs.update(l => [incoming, ...l]);
      return { id: incoming.id, added: true };
    }
    const merged = mergeRuns(ensureStamps(local), incoming);
    if (signature(merged) !== signature(local)) this.replace(merged);
    return { id: incoming.id, added: false };
  }

  private withEnc(r: Run, key: string, p: PlayerId, enc: Encounter | null): Run {
    const log = { ...(r.areas[key] ?? {}) };
    if (enc) log[p] = enc; else delete log[p];
    return { ...r, areas: { ...r.areas, [key]: log } };
  }

  private partyCount(r: Run, p: PlayerId): number {
    let n = 0;
    for (const [key, log] of Object.entries(r.areas)) {
      const e = log[p];
      if (e?.outcome === 'caught' && e.slot === 'party' && !this.isVoid(r, key, p)) n++;
    }
    return n;
  }

  // ── encounter actions ──────────────────────────────────────────────────────

  private label(slug: string): string { return this.dex.displayName(slug); }

  /** Log an encounter. With the dupes clause on, a species from a line you already own becomes a dupe automatically. */
  logEncounter(key: string, p: PlayerId, species: string, level = 0, opts: { force?: boolean; shiny?: boolean } = {}): void {
    const r0 = this.run();
    if (!r0) return;
    const dupe = r0.rules.dupesClause && !opts.force && !opts.shiny && this.ownedChains(p, key).has(this.lineKey(species));
    if (dupe) {
      this.mutate(`Dupe at ${this.nameOf(key)}: you already have the ${this.dex.lineName(species)} line`, r =>
        this.withEnc(r, key, p, { species, outcome: 'dupe', nickname: '', level, slot: 'box' }), 'miss');
      return;
    }
    this.mutate(`${opts.shiny ? '✨ Shiny ' : ''}${this.label(species)} caught at ${this.nameOf(key)}`, r => {
      const prev = r.areas[key]?.[p];
      const kept = prev?.outcome === 'caught';
      const enc: Encounter = {
        species, outcome: 'caught', shiny: opts.shiny || (kept ? prev.shiny : undefined),
        nickname: kept ? prev.nickname : '',
        level: kept && prev.level ? prev.level : level,
        slot: kept ? prev.slot : (this.partyCount(r, p) < PARTY_SIZE ? 'party' : 'box'),
        cause: kept ? prev.cause : undefined, diedAt: kept ? prev.diedAt : undefined,
      };
      return this.withEnc(r, key, p, enc);
    }, 'catch');
  }

  markMiss(key: string, p: PlayerId, outcome: Exclude<Outcome, 'caught'>): void {
    const label = { failed: 'No catch', dupe: 'Dupe', skipped: 'Skipped' }[outcome];
    this.mutate(`${label} at ${this.nameOf(key)}`, r =>
      this.withEnc(r, key, p, { species: '', outcome, nickname: '', level: 0, slot: 'box' }), 'miss');
  }

  /** Marks every unlogged encounter above an area as skipped (for starting mid-game or catching up). */
  skipBefore(key: string): void {
    const r0 = this.run();
    if (!r0) return;
    const areas = this.areaSteps();
    const idx = areas.findIndex(a => a.key === key);
    const missing = areas.slice(0, Math.max(idx, 0)).flatMap(a =>
      this.players().filter(pl => !r0.areas[a.key]?.[pl]).map(pl => [a.key, pl] as const));
    if (!missing.length) { this.flash('Everything above is already logged'); return; }
    this.mutate(`Skipped ${missing.length} unlogged encounter${missing.length === 1 ? '' : 's'} above ${this.nameOf(key)}`, r => {
      let next = r;
      for (const [k, pl] of missing) next = this.withEnc(next, k, pl, { species: '', outcome: 'skipped', nickname: '', level: 0, slot: 'box' });
      return next;
    }, 'miss');
  }

  clearEncounter(key: string, p: PlayerId): void {
    this.mutate(`Cleared ${this.nameOf(key)}`, r => this.withEnc(r, key, p, null));
  }

  patch(key: string, p: PlayerId, patch: Partial<Pick<Encounter, 'nickname' | 'level' | 'cause' | 'shiny' | 'ability' | 'item' | 'moves' | 'note'>>): void {
    this.mutate(null, r => {
      const enc = r.areas[key]?.[p];
      if (!enc) return null;
      const next = { ...enc, ...patch };
      if (patch.level !== undefined) next.level = Math.max(0, Math.min(100, Math.round(patch.level) || 0));
      return this.withEnc(r, key, p, next);
    });
  }

  /** After a won battle: +1 (or any delta) to every Pokémon in the party. */
  bumpParty(delta: number, player?: PlayerId): void {
    const targets = this.players().filter(p => !player || p === player).flatMap(p => this.party()[p]);
    if (!targets.length) return;
    this.mutate(`Party ${delta > 0 ? '+' : ''}${delta} level${Math.abs(delta) === 1 ? '' : 's'}`, r => {
      let next = r;
      for (const t of targets) {
        const e = next.areas[t.key]?.[t.player];
        if (e) next = this.withEnc(next, t.key, t.player, { ...e, level: Math.max(1, Math.min(100, (e.level || 0) + delta)) });
      }
      return next;
    });
  }

  changeForm(key: string, p: PlayerId, to: string): void {
    const enc = this.encounter(key, p);
    if (!enc || enc.outcome !== 'caught') return;
    this.mutate(`${enc.nickname || this.label(enc.species)} is ${this.label(to)}`, r => this.withEnc(r, key, p, { ...enc, species: to, ability: undefined }), 'evolve');
  }

  evolve(key: string, p: PlayerId, to: string): void {
    const enc = this.encounter(key, p);
    if (!enc || enc.outcome !== 'caught') return;
    this.mutate(`${enc.nickname || this.label(enc.species)} evolved into ${this.label(to)}`,
      r => this.withEnc(r, key, p, { ...enc, species: to }), 'evolve');
  }

  toggleSlot(key: string, p: PlayerId): void {
    const r = this.run();
    const enc = r?.areas[key]?.[p];
    if (!r || !enc || enc.outcome !== 'caught' || enc.slot === 'grave') return;
    if (this.isVoid(r, key, p)) { this.flash('Void: the linked partner missed this area'); return; }
    const toParty = enc.slot === 'box';
    if (toParty && this.partyCount(r, p) >= PARTY_SIZE) { this.flash('Party is full: move someone to the box first'); return; }
    const other = OTHER[p];
    const partner = r.areas[key]?.[other];
    const pair = r.mode === 'soullink' && r.rules.pairedParty && partner?.outcome === 'caught'
      && partner.slot === enc.slot && !this.isVoid(r, key, other);
    if (pair && toParty && this.partyCount(r, other) >= PARTY_SIZE) { this.flash(`${this.playerName(other)}'s party is full`); return; }
    const slot = toParty ? 'party' : 'box';
    this.mutate(null, x => {
      const next = this.withEnc(x, key, p, { ...enc, slot });
      return pair ? this.withEnc(next, key, other, { ...partner!, slot }) : next;
    });
  }

  kill(key: string, p: PlayerId, cause: string): void {
    const r0 = this.run();
    const e0 = r0?.areas[key]?.[p];
    if (!r0 || !e0 || e0.outcome !== 'caught' || e0.slot === 'grave') return;
    const who = (e: Encounter) => e.nickname || this.label(e.species);
    const partner0 = r0.areas[key]?.[OTHER[p]];
    const both = r0.mode === 'soullink' && r0.rules.linkedDeath && partner0?.outcome === 'caught' && partner0.slot !== 'grave';
    const why = cause.trim() || 'Unknown';
    this.mutate(`☠ ${who(e0)} fell (${why})${both ? ' and its soul link fell too' : ''}`, r => {
      const diedAt = this.frontierName() ?? this.nameOf(key);
      let next = this.withEnc(r, key, p, { ...e0, slot: 'grave', cause: why, diedAt });
      if (both) {
        next = this.withEnc(next, key, OTHER[p], {
          ...partner0!, slot: 'grave', diedAt, cause: `Soul link: ${p === 'p1' ? r.p1Name : r.p2Name}'s ${who(e0)}`,
        });
      }
      return next;
    }, 'death');
  }

  revive(key: string, p: PlayerId): void {
    this.mutate('Revived', r => {
      const enc = r.areas[key]?.[p];
      if (!enc || enc.slot !== 'grave') return null;
      const back = (e: Encounter, who: PlayerId): Encounter =>
        ({ ...e, slot: this.partyCount(r, who) < PARTY_SIZE ? 'party' : 'box', cause: undefined, diedAt: undefined });
      let next = this.withEnc(r, key, p, back(enc, p));
      const partner = r.areas[key]?.[OTHER[p]];
      if (partner?.slot === 'grave' && partner.cause?.startsWith('Soul link')) {
        next = this.withEnc(next, key, OTHER[p], back(partner, OTHER[p]));
      }
      return next;
    });
  }

  addNote(text: string): void {
    const t = text.trim();
    if (t) this.mutate(null, r => ({ ...r, journal: [...r.journal, { t: Date.now(), kind: 'note' as const, text: t }] }));
  }

  duplicate(id: string): Run | null {
    const r = this.runs().find(x => x.id === id);
    if (!r) return null;
    const now = Date.now();
    const copy: Run = { ...structuredClone(r), id: newId(), name: `${r.name} (copy)`, createdAt: now, updatedAt: now, share: undefined };
    this.runs.update(l => [copy, ...l]);
    return copy;
  }

  resetProgress(): void {
    this.mutate('Progress reset', r => ({ ...r, areas: {}, bosses: {} }));
  }

  // ── soullink pair actions ──────────────────────────────────────────────────

  /** Moves both halves of a pair together. `to` defaults to the opposite of where the pair is now. */
  movePair(key: string, to?: 'party' | 'box'): void {
    const r = this.run();
    const a = r?.areas[key]?.p1;
    const b = r?.areas[key]?.p2;
    if (!r || a?.outcome !== 'caught' || b?.outcome !== 'caught' || a.slot === 'grave' || b.slot === 'grave') return;
    if (this.isVoid(r, key, 'p1') || this.isVoid(r, key, 'p2')) return;
    const target: 'party' | 'box' = to ?? (a.slot === 'party' && b.slot === 'party' ? 'box' : 'party');
    if (target === 'party') {
      const needA = a.slot === 'party' ? 0 : 1;
      const needB = b.slot === 'party' ? 0 : 1;
      if (this.partyCount(r, 'p1') + needA > PARTY_SIZE) { this.flash(`${r.p1Name}'s party is full`); return; }
      if (this.partyCount(r, 'p2') + needB > PARTY_SIZE) { this.flash(`${r.p2Name}'s party is full`); return; }
    }
    this.mutate(null, x => this.withEnc(this.withEnc(x, key, 'p1', { ...a, slot: target }), key, 'p2', { ...b, slot: target }));
  }

  /** Boxes one pair and brings another into the party in a single step (undoable as one). */
  swapPairs(inKey: string, outKey: string): void {
    const r = this.run();
    if (!r) return;
    const set = (x: Run, key: string, slot: 'party' | 'box'): Run => {
      let n = x;
      for (const p of ['p1', 'p2'] as const) {
        const e = n.areas[key]?.[p];
        if (e?.outcome === 'caught' && e.slot !== 'grave') n = this.withEnc(n, key, p, { ...e, slot });
      }
      return n;
    };
    this.mutate('Swapped pairs', x => set(set(x, outKey, 'box'), inKey, 'party'));
  }

  killPair(key: string, cause: string): void {
    for (const p of ['p1', 'p2'] as const) this.kill(key, p, cause);
  }

  revivePair(key: string): void {
    this.revive(key, 'p1');
    this.revive(key, 'p2');
  }

  private frontierName(): string | null {
    const f = this.frontier();
    return f ? this.nameOf(f) : null;
  }

  // ── bosses, rules, areas ───────────────────────────────────────────────────

  toggleBoss(name: string): void {
    const defeating = !this.isDefeated(name);
    this.mutate(defeating ? `${name} defeated` : `${name} reopened`, r => {
      const cur = r.bosses[name] ?? { defeated: false };
      return { ...r, bosses: { ...r.bosses, [name]: { ...cur, defeated: defeating } } };
    }, 'boss');
  }

  setBossCap(name: string, cap: number | null): void {
    this.mutate(null, r => {
      const cur = r.bosses[name] ?? { defeated: false };
      const next = { ...cur, cap: cap && cap > 0 ? Math.min(100, Math.round(cap)) : undefined };
      return { ...r, bosses: { ...r.bosses, [name]: next } };
    });
  }

  setRules(patch: Partial<Rules>): void { this.mutate(null, r => ({ ...r, rules: { ...r.rules, ...patch } })); }

  rename(name: string): void {
    const n = name.trim();
    if (n) this.mutate(null, r => ({ ...r, name: n }));
  }

  addArea(name: string): void {
    const n = name.trim();
    if (!n) return;
    this.mutate(null, r => {
      if (areaNames(r).some(a => areaKey(a) === areaKey(n))) return null;
      return { ...r, customAreas: [...r.customAreas, n] };
    });
  }

  removeArea(name: string): void {
    this.mutate(`Removed ${name}`, r => ({ ...r, customAreas: r.customAreas.filter(a => a !== name) }));
  }

  // ── persistence ────────────────────────────────────────────────────────────

  private normalize(r: Run): Run {
    return { ...r, v: 2, rules: { ...RULE_PRESETS[0].rules, ...r.rules }, customAreas: r.customAreas ?? [], areas: r.areas ?? {}, bosses: r.bosses ?? {}, journal: r.journal ?? [] };
  }

  private load(): Run[] {
    try {
      const raw = localStorage.getItem(STORAGE_V2);
      if (raw) return ((JSON.parse(raw).runs ?? []) as Run[]).map(r => this.normalize(r));
    } catch { /* fall through to v1 */ }
    try {
      const v1 = localStorage.getItem(STORAGE_V1);
      if (v1) return migrateV1(JSON.parse(v1));
    } catch { /* nothing to migrate */ }
    return [];
  }

  private save(runs: Run[]): void {
    try { localStorage.setItem(STORAGE_V2, JSON.stringify({ v: 2, runs })); } catch { /* quota */ }
  }
}
