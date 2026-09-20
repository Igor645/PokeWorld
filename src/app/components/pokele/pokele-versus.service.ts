import { Injectable, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { DataConnection, Peer } from 'peerjs';

export interface VsPlayer {
  id: string;
  name: string;
  points: number;
  /** one pattern string per guess ("gynnyng"), never the Pokémon guessed, so watching does not help */
  rows: string[];
  lives: number;
  done: 'won' | 'lost' | null;
  elapsed: number | null;
  /** points earned this round, filled in when the round is over */
  gained: number;
}

export interface VsRound { n: number; targetId: number; pool: number | null; }
export type VsStatus = 'off' | 'connecting' | 'live' | 'error';

type Msg =
  | { t: 'hello'; name: string }
  | { t: 'progress'; rows: string[]; lives: number; done: 'won' | 'lost' | null; elapsed: number | null }
  | { t: 'state'; players: VsPlayer[]; round: VsRound | null; over: boolean }
  | { t: 'round'; round: VsRound };

const PREFIX = 'pkvs-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const POINTS = [5, 3, 2];

/**
 * Head-to-head Pokéle over WebRTC (PeerJS), no backend. The player who creates a room is the host: they claim the
 * room's peer id, choose each round's Pokémon and keep the scoreboard. Guests connect to the host, report their
 * progress and receive the shared state. Guests only ever send colour patterns, never which Pokémon they guessed.
 */
@Injectable()
export class PokeleVersusService implements OnDestroy {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly status = signal<VsStatus>('off');
  readonly error = signal('');
  readonly code = signal('');
  readonly isHost = signal(false);
  readonly myId = signal('');
  readonly players = signal<VsPlayer[]>([]);
  readonly round = signal<VsRound | null>(null);
  /** true once everyone has finished the current round */
  readonly over = signal(false);

  private peer: Peer | null = null;
  private hostConn: DataConnection | null = null;
  private readonly guestConns = new Map<string, DataConnection>();
  private readonly roster = new Map<string, VsPlayer>();
  private myName = 'Player';
  private generation = 0;
  private push: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void { this.leave(); }

  // ── lifecycle ──────────────────────────────────────────────────────────────

  async create(name: string): Promise<void> {
    if (!this.browser) return;
    this.leave();
    this.myName = this.clean(name);
    const gen = ++this.generation;
    this.status.set('connecting');
    this.error.set('');
    try {
      const { Peer: PeerCtor } = await import('peerjs');
      for (let attempt = 0; attempt < 6; attempt++) {
        if (gen !== this.generation) return;
        const code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
        if (await this.claim(PeerCtor, code, gen)) return;
      }
      this.fail('Could not open a room. Try again.');
    } catch {
      this.fail('Could not load the multiplayer library.');
    }
  }

  private claim(PeerCtor: typeof Peer, code: string, gen: number): Promise<boolean> {
    return new Promise(resolve => {
      const peer = new PeerCtor(PREFIX + code.toLowerCase());
      let settled = false;
      peer.on('open', id => {
        if (gen !== this.generation) { peer.destroy(); resolve(true); return; }
        settled = true;
        this.peer = peer;
        this.code.set(code);
        this.isHost.set(true);
        this.myId.set(id);
        this.roster.set(id, this.blank(id, this.myName));
        this.publish();
        this.status.set('live');
        resolve(true);
      });
      peer.on('connection', conn => this.attachGuest(conn, gen));
      peer.on('disconnected', () => { if (settled && gen === this.generation && !peer.destroyed) peer.reconnect(); });
      peer.on('error', err => {
        if (!settled) { peer.destroy(); resolve(false); return; }
        if (gen === this.generation) this.fail(`Connection problem (${err.type}).`);
      });
    });
  }

  async join(rawCode: string, name: string): Promise<void> {
    if (!this.browser) return;
    this.leave();
    const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 4) { this.fail('Room codes have four characters.'); return; }
    this.myName = this.clean(name);
    const gen = ++this.generation;
    this.status.set('connecting');
    this.error.set('');
    try {
      const { Peer: PeerCtor } = await import('peerjs');
      if (gen !== this.generation) return;
      const peer = new PeerCtor();
      this.peer = peer;
      const timer = setTimeout(() => { if (gen === this.generation && this.status() === 'connecting') this.fail('Nobody answered. Check the code and that the host is online.'); }, 12000);
      peer.on('open', id => {
        if (gen !== this.generation) return;
        this.myId.set(id);
        const conn = peer.connect(PREFIX + code.toLowerCase(), { reliable: true });
        this.hostConn = conn;
        conn.on('open', () => {
          clearTimeout(timer);
          this.code.set(code);
          this.isHost.set(false);
          this.status.set('live');
          conn.send({ t: 'hello', name: this.myName } satisfies Msg);
        });
        conn.on('data', data => this.guestReceive(data as Msg));
        conn.on('close', () => { if (gen === this.generation) this.fail('The host left the room.'); });
      });
      peer.on('error', err => {
        clearTimeout(timer);
        if (gen !== this.generation) return;
        this.fail(err.type === 'peer-unavailable' ? 'No room with that code.' : `Connection problem (${err.type}).`);
      });
    } catch {
      this.fail('Could not load the multiplayer library.');
    }
  }

  leave(): void {
    this.generation++;
    if (this.push) clearTimeout(this.push);
    for (const c of this.guestConns.values()) c.close();
    this.guestConns.clear();
    this.hostConn?.close();
    this.hostConn = null;
    this.peer?.destroy();
    this.peer = null;
    this.roster.clear();
    this.status.set('off');
    this.error.set('');
    this.code.set('');
    this.isHost.set(false);
    this.myId.set('');
    this.players.set([]);
    this.round.set(null);
    this.over.set(false);
  }

  private fail(message: string): void {
    this.generation++;
    this.peer?.destroy();
    this.peer = null;
    this.hostConn = null;
    this.status.set('error');
    this.error.set(message);
  }

  // ── host side ──────────────────────────────────────────────────────────────

  private attachGuest(conn: DataConnection, gen: number): void {
    conn.on('open', () => {
      if (gen !== this.generation) { conn.close(); return; }
      this.guestConns.set(conn.peer, conn);
      this.roster.set(conn.peer, this.blank(conn.peer, 'Player'));
      this.publish();
      // a guest that joins mid-round gets the current round straight away
      const r = this.round();
      if (r) conn.send({ t: 'round', round: r } satisfies Msg);
    });
    conn.on('data', data => this.hostReceive(conn.peer, data as Msg));
    const gone = () => {
      this.guestConns.delete(conn.peer);
      this.roster.delete(conn.peer);
      this.checkRoundOver();
      this.publish();
    };
    conn.on('close', gone);
    conn.on('error', gone);
  }

  private hostReceive(from: string, msg: Msg): void {
    if (!msg || typeof msg !== 'object') return;
    const p = this.roster.get(from);
    if (!p) return;
    if (msg.t === 'hello' && typeof msg.name === 'string') {
      p.name = this.clean(msg.name);
    } else if (msg.t === 'progress') {
      this.applyProgress(p, msg);
    }
    this.checkRoundOver();
    this.publish();
  }

  private applyProgress(p: VsPlayer, m: { rows: string[]; lives: number; done: 'won' | 'lost' | null; elapsed: number | null }): void {
    if (this.over()) return;
    p.rows = Array.isArray(m.rows) ? m.rows.filter(r => typeof r === 'string').map(r => r.slice(0, 12)).slice(0, 20) : [];
    p.lives = Math.max(0, Math.min(7, Number(m.lives) || 0));
    p.done = m.done === 'won' || m.done === 'lost' ? m.done : null;
    p.elapsed = p.done && typeof m.elapsed === 'number' ? m.elapsed : null;
  }

  /** Host only: starts the next round with the chosen Pokémon. */
  startRound(targetId: number, pool: number | null): void {
    if (!this.isHost()) return;
    const round: VsRound = { n: (this.round()?.n ?? 0) + 1, targetId, pool };
    for (const p of this.roster.values()) Object.assign(p, { rows: [], lives: 7, done: null, elapsed: null, gained: 0 });
    this.over.set(false);
    this.round.set(round);
    for (const c of this.guestConns.values()) if (c.open) c.send({ t: 'round', round } satisfies Msg);
    this.publish();
  }

  private checkRoundOver(): void {
    if (!this.isHost() || this.over() || !this.round()) return;
    const all = [...this.roster.values()];
    if (!all.length || !all.every(p => p.done)) return;
    const winners = all.filter(p => p.done === 'won')
      .sort((a, b) => b.lives - a.lives || (a.elapsed ?? Infinity) - (b.elapsed ?? Infinity));
    winners.forEach((p, i) => { p.gained = POINTS[i] ?? 1; p.points += p.gained; });
    this.over.set(true);
  }

  /** Host: sends the roster to everyone (throttled) and keeps the local signals in sync. */
  private publish(): void {
    const players = [...this.roster.values()].map(p => ({ ...p }));
    this.players.set(players);
    if (this.push) return;
    this.push = setTimeout(() => {
      this.push = null;
      const msg: Msg = { t: 'state', players: [...this.roster.values()].map(p => ({ ...p })), round: this.round(), over: this.over() };
      for (const c of this.guestConns.values()) if (c.open) c.send(msg);
    }, 80);
  }

  // ── guest side ─────────────────────────────────────────────────────────────

  private guestReceive(msg: Msg): void {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'round' && msg.round && typeof msg.round.targetId === 'number') {
      this.over.set(false);
      this.round.set(msg.round);
    } else if (msg.t === 'state' && Array.isArray(msg.players)) {
      this.players.set(msg.players);
      this.over.set(!!msg.over);
      if (msg.round) this.round.set(msg.round);
    }
  }

  // ── both ───────────────────────────────────────────────────────────────────

  /** Reports my board: patterns only. */
  sendProgress(rows: string[], lives: number, done: 'won' | 'lost' | null, elapsed: number | null): void {
    if (this.status() !== 'live') return;
    if (this.isHost()) {
      const me = this.roster.get(this.myId());
      if (me) { this.applyProgress(me, { rows, lives, done, elapsed }); this.checkRoundOver(); this.publish(); }
    } else if (this.hostConn?.open) {
      this.hostConn.send({ t: 'progress', rows, lives, done, elapsed } satisfies Msg);
    }
  }

  setName(name: string): void {
    this.myName = this.clean(name);
    if (this.isHost()) {
      const me = this.roster.get(this.myId());
      if (me) { me.name = this.myName; this.publish(); }
    } else if (this.hostConn?.open) {
      this.hostConn.send({ t: 'hello', name: this.myName } satisfies Msg);
    }
  }

  private blank(id: string, name: string): VsPlayer {
    return { id, name: this.clean(name), points: 0, rows: [], lives: 7, done: null, elapsed: null, gained: 0 };
  }

  private clean(name: string): string { return (name ?? '').trim().slice(0, 20) || 'Player'; }
}
