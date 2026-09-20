import { BossState, Encounter, JournalEntry, PlayerId, Rules, Run } from './models';

/**
 * Live co-editing works on "cells": one encounter (area x player), one boss, and the run settings.
 * Every edit stamps the cells it touched with the current time; merging two copies keeps, per cell, the newest edit
 * (last writer wins) and unions the journals. The same cells are what undo restores, so undoing your own
 * action never overwrites something your partner did in the meantime.
 */

export type CellKey = string; // 'a|<areaKey>|p1' | 'b|<boss name>' | 'm'
export interface Cell { key: CellKey; before: unknown; after: unknown; }

interface Meta { name: string; p1Name: string; p2Name: string; rules: Rules; customAreas: string[]; }
const PLAYERS: PlayerId[] = ['p1', 'p2'];

const metaOf = (r: Run): Meta => ({ name: r.name, p1Name: r.p1Name, p2Name: r.p2Name, rules: r.rules, customAreas: r.customAreas });

export function getCell(run: Run, key: CellKey): unknown {
  const [kind, a, b] = key.split('|');
  if (kind === 'a') return run.areas[a]?.[b as PlayerId];
  if (kind === 'b') return run.bosses[a];
  return metaOf(run);
}

export function setCell(run: Run, key: CellKey, value: unknown): Run {
  const [kind, a, b] = key.split('|');
  if (kind === 'a') {
    const log = { ...(run.areas[a] ?? {}) };
    if (value) log[b as PlayerId] = value as Encounter; else delete log[b as PlayerId];
    return { ...run, areas: { ...run.areas, [a]: log } };
  }
  if (kind === 'b') {
    const bosses = { ...run.bosses };
    if (value) bosses[a] = value as BossState; else delete bosses[a];
    return { ...run, bosses };
  }
  return { ...run, ...(value as Meta) };
}

/** Which cells differ between two versions of a run (by reference: the store only ever replaces what it edits). */
export function diffCells(prev: Run, next: Run): Cell[] {
  const cells: Cell[] = [];
  for (const k of new Set([...Object.keys(prev.areas), ...Object.keys(next.areas)])) {
    for (const p of PLAYERS) {
      const before = prev.areas[k]?.[p];
      const after = next.areas[k]?.[p];
      if (before !== after) cells.push({ key: `a|${k}|${p}`, before, after });
    }
  }
  for (const n of new Set([...Object.keys(prev.bosses), ...Object.keys(next.bosses)])) {
    if (prev.bosses[n] !== next.bosses[n]) cells.push({ key: `b|${n}`, before: prev.bosses[n], after: next.bosses[n] });
  }
  if (prev.name !== next.name || prev.p1Name !== next.p1Name || prev.p2Name !== next.p2Name
    || prev.rules !== next.rules || prev.customAreas !== next.customAreas) {
    cells.push({ key: 'm', before: metaOf(prev), after: metaOf(next) });
  }
  return cells;
}

export function stampCells(run: Run, keys: CellKey[], now: number): Run {
  if (!keys.length) return run;
  const stamps = { ...(run.stamps ?? {}) };
  for (const k of keys) stamps[k] = now;
  return { ...run, stamps };
}

/** Gives every existing cell of an older run a stamp, so it can take part in merging. */
export function ensureStamps(run: Run): Run {
  const stamps = { ...(run.stamps ?? {}) };
  const t = run.updatedAt || Date.now();
  for (const [k, log] of Object.entries(run.areas)) for (const p of PLAYERS) if (log[p]) stamps[`a|${k}|${p}`] ??= t;
  for (const n of Object.keys(run.bosses)) stamps[`b|${n}`] ??= t;
  stamps['m'] ??= t;
  return { ...run, stamps };
}

const json = (v: unknown): string => JSON.stringify(v) ?? '';

export function mergeRuns(local: Run, remote: Run): Run {
  const ls = local.stamps ?? {};
  const rs = remote.stamps ?? {};
  const stamps: Record<string, number> = { ...ls };
  let out = local;
  for (const key of new Set([...Object.keys(ls), ...Object.keys(rs)])) {
    const lt = ls[key] ?? 0;
    const rt = rs[key] ?? 0;
    const remoteWins = rt > lt || (rt === lt && rt > 0 && json(getCell(remote, key)) > json(getCell(local, key)));
    if (remoteWins) {
      out = setCell(out, key, getCell(remote, key));
      stamps[key] = rt;
    }
  }
  const seen = new Map<string, JournalEntry>();
  for (const e of [...local.journal, ...remote.journal]) seen.set(`${e.t}|${e.kind}|${e.text}`, e);
  const journal = [...seen.values()].sort((a, b) => a.t - b.t).slice(-500);
  return { ...out, stamps, journal, share: local.share ?? remote.share, updatedAt: Math.max(local.updatedAt, remote.updatedAt) };
}

/** Cheap fingerprint used to decide whether a merge actually changed anything. */
export function signature(run: Run): string {
  return `${Object.entries(run.stamps ?? {}).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => k + v).join(',')}#${run.journal.length}`;
}

export function newShareKey(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map(b => alphabet[b % alphabet.length]).join('');
}
