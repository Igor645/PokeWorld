import { Injectable, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { DataConnection, Peer } from 'peerjs';

export interface QzPlayer { id: string; name: string; color: string; claims: number; points: number; }
export interface QzRound { n: number; modeKey: string; limitSec: number; total: number; }
export type QzStatus = 'off' | 'connecting' | 'live' | 'error';

/** Silhouettes are a room-wide hint: someone proposes, every player must agree, then it is on for everybody. */
export interface QzHint {
  on: boolean;
  /** id of the player who asked, while a vote is open */
  by: string | null;
  votes: Record<string, boolean>;
  /** bumped every time somebody declines, so clients can react once */
  denied: { by: string; n: number } | null;
}

const NO_HINT: QzHint = { on: false, by: null, votes: {}, denied: null };

type Msg =
  | { t: 'hello'; name: string }
  | { t: 'claim'; ids: number[] }
  | { t: 'hint' }
  | { t: 'vote'; yes: boolean }
  | { t: 'round'; round: QzRound }
  | { t: 'state'; players: QzPlayer[]; claims: Array<[number, string]>; round: QzRound | null; over: boolean; hint: QzHint };

const PREFIX = 'qzvs-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const COLORS = ['#ef5350', '#42a5f5', '#66bb6a', '#ffa726', '#ab47bc', '#26c6da', '#ec407a', '#d4e157'];
const POINTS = [5, 3, 2];

/**
 * Shared-board Pokédex quiz over WebRTC (PeerJS, no backend). Everybody plays the same board at once and the
 * first player to name a Pokémon claims its slot for everyone: play it as a team (the board fills up faster) or
 * against each other (whoever claimed the most wins). The room's creator is the host: they pick the board and the
 * time limit, decide who claimed what and end the round.
 */
@Injectable()
export class QuizVersusService implements OnDestroy {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly status = signal<QzStatus>('off');
  readonly error = signal('');
  readonly code = signal('');
  readonly isHost = signal(false);
  readonly myId = signal('');
  readonly players = signal<QzPlayer[]>([]);
  readonly round = signal<QzRound | null>(null);
  /** slot (species id) -> id of the player who claimed it */
  readonly claims = signal<Map<number, string>>(new Map());
  readonly over = signal(false);
  readonly hint = signal<QzHint>(NO_HINT);

  private peer: Peer | null = null;
  private hostConn: DataConnection | null = null;
  private readonly guestConns = new Map<string, DataConnection>();
  private readonly roster = new Map<string, QzPlayer>();
  private readonly owned = new Map<number, string>();
  private hintState: QzHint = NO_HINT;
  private myName = 'Player';
  private generation = 0;
  private push: ReturnType<typeof setTimeout> | null = null;
  private roundTimer: ReturnType<typeof setTimeout> | null = null;

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
        if (await this.claimRoom(PeerCtor, code, gen)) return;
      }
      this.fail('Could not open a room. Try again.');
    } catch {
      this.fail('Could not load the multiplayer library.');
    }
  }

  private claimRoom(PeerCtor: typeof Peer, code: string, gen: number): Promise<boolean> {
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
        this.addPlayer(id, this.myName);
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
    if (this.roundTimer) clearTimeout(this.roundTimer);
    this.push = this.roundTimer = null;
    for (const c of this.guestConns.values()) c.close();
    this.guestConns.clear();
    this.hostConn?.close();
    this.hostConn = null;
    this.peer?.destroy();
    this.peer = null;
    this.roster.clear();
    this.owned.clear();
    this.status.set('off');
    this.error.set('');
    this.code.set('');
    this.isHost.set(false);
    this.myId.set('');
    this.players.set([]);
    this.round.set(null);
    this.claims.set(new Map());
    this.over.set(false);
    this.hintState = NO_HINT;
    this.hint.set(NO_HINT);
  }

  private fail(message: string): void {
    this.generation++;
    if (this.roundTimer) clearTimeout(this.roundTimer);
    this.peer?.destroy();
    this.peer = null;
    this.hostConn = null;
    this.status.set('error');
    this.error.set(message);
  }

  // ── host side ──────────────────────────────────────────────────────────────

  private addPlayer(id: string, name: string): QzPlayer {
    const used = new Set([...this.roster.values()].map(p => p.color));
    const color = COLORS.find(c => !used.has(c)) ?? COLORS[this.roster.size % COLORS.length];
    const p: QzPlayer = { id, name: this.clean(name), color, claims: 0, points: 0 };
    this.roster.set(id, p);
    return p;
  }

  private attachGuest(conn: DataConnection, gen: number): void {
    conn.on('open', () => {
      if (gen !== this.generation) { conn.close(); return; }
      this.guestConns.set(conn.peer, conn);
      this.addPlayer(conn.peer, 'Player');
      this.publish();
      const r = this.round();
      if (r && !this.over()) conn.send({ t: 'round', round: r } satisfies Msg);
    });
    conn.on('data', data => this.hostReceive(conn.peer, data as Msg));
    const gone = () => {
      this.guestConns.delete(conn.peer);
      this.roster.delete(conn.peer);
      this.hintDeparted(conn.peer);
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
      this.publish();
    } else if (msg.t === 'claim' && Array.isArray(msg.ids)) {
      this.applyClaims(from, msg.ids);
    } else if (msg.t === 'hint') {
      this.hintProposed(from);
    } else if (msg.t === 'vote') {
      this.hintVoted(from, !!msg.yes);
    }
  }

  private applyClaims(from: string, ids: number[]): void {
    const r = this.round();
    const p = this.roster.get(from);
    if (!r || !p || this.over()) return;
    for (const raw of ids.slice(0, 20)) {
      const id = Number(raw);
      if (!Number.isInteger(id) || id < 1 || id > 5000 || this.owned.has(id)) continue;
      this.owned.set(id, from);
      p.claims++;
    }
    if (this.owned.size >= r.total) this.endRound();
    this.publish();
  }

  /** Host: starts a round on the chosen board (`total` is how many Pokémon it holds). */
  startRound(modeKey: string, limitSec: number, total: number): void {
    if (!this.isHost()) return;
    if (this.roundTimer) clearTimeout(this.roundTimer);
    const round: QzRound = { n: (this.round()?.n ?? 0) + 1, modeKey, limitSec, total };
    this.owned.clear();
    for (const p of this.roster.values()) p.claims = 0;
    this.hintState = NO_HINT;
    this.over.set(false);
    this.round.set(round);
    if (limitSec > 0) this.roundTimer = setTimeout(() => { this.endRound(); this.publish(); }, limitSec * 1000 + 800);
    for (const c of this.guestConns.values()) if (c.open) c.send({ t: 'round', round } satisfies Msg);
    this.publish();
  }

  /** Host: ends the round now (needed when there is no time limit). */
  endNow(): void {
    if (!this.isHost() || !this.round()) return;
    this.endRound();
    this.publish();
  }

  private endRound(): void {
    if (this.over()) return;
    if (this.roundTimer) clearTimeout(this.roundTimer);
    this.roundTimer = null;
    const ranked = [...this.roster.values()].filter(p => p.claims > 0).sort((a, b) => b.claims - a.claims);
    let place = 0;
    ranked.forEach((p, i) => {
      if (i > 0 && p.claims < ranked[i - 1].claims) place = i;
      p.points += POINTS[place] ?? 1;
    });
    this.over.set(true);
  }

  // ── silhouette vote (host decides) ─────────────────────────────────────────

  private hintProposed(from: string): void {
    if (!this.round() || this.over() || this.hintState.on || this.hintState.by || !this.roster.has(from)) return;
    this.hintState = { ...this.hintState, by: from, votes: { [from]: true } };
    this.hintCheck();
    this.publish();
  }

  private hintVoted(from: string, yes: boolean): void {
    const h = this.hintState;
    if (!h.by || h.on || from in h.votes || !this.roster.has(from)) return;
    if (!yes) {
      this.hintState = { on: false, by: null, votes: {}, denied: { by: this.roster.get(from)?.name ?? 'Someone', n: (h.denied?.n ?? 0) + 1 } };
    } else {
      this.hintState = { ...h, votes: { ...h.votes, [from]: true } };
      this.hintCheck();
    }
    this.publish();
  }

  private hintDeparted(id: string): void {
    const h = this.hintState;
    if (!h.by) return;
    if (h.by === id) { this.hintState = { ...NO_HINT, denied: h.denied }; return; }
    const votes = { ...h.votes };
    delete votes[id];
    this.hintState = { ...h, votes };
    this.hintCheck();
  }

  /** Everyone in the room has agreed: silhouettes go on for all. */
  private hintCheck(): void {
    const h = this.hintState;
    if (h.by && [...this.roster.keys()].every(id => h.votes[id])) this.hintState = { on: true, by: null, votes: {}, denied: h.denied };
  }

  requestHint(): void {
    if (this.status() !== 'live') return;
    if (this.isHost()) this.hintProposed(this.myId());
    else if (this.hostConn?.open) this.hostConn.send({ t: 'hint' } satisfies Msg);
  }

  voteHint(yes: boolean): void {
    if (this.status() !== 'live') return;
    if (this.isHost()) this.hintVoted(this.myId(), yes);
    else if (this.hostConn?.open) this.hostConn.send({ t: 'vote', yes } satisfies Msg);
  }

  private publish(): void {
    this.hint.set(this.hintState);
    this.claims.set(new Map(this.owned));
    this.players.set([...this.roster.values()].map(p => ({ ...p })));
    if (this.push) return;
    this.push = setTimeout(() => {
      this.push = null;
      const msg: Msg = {
        t: 'state', players: [...this.roster.values()].map(p => ({ ...p })),
        claims: [...this.owned.entries()], round: this.round(), over: this.over(), hint: this.hintState,
      };
      for (const c of this.guestConns.values()) if (c.open) c.send(msg);
    }, 60);
  }

  // ── guest side ─────────────────────────────────────────────────────────────

  private guestReceive(msg: Msg): void {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'round' && msg.round && typeof msg.round.modeKey === 'string') {
      this.over.set(false);
      this.claims.set(new Map());
      this.hint.set(NO_HINT);
      this.round.set(msg.round);
    } else if (msg.t === 'state' && Array.isArray(msg.players)) {
      this.players.set(msg.players);
      this.claims.set(new Map(msg.claims ?? []));
      this.over.set(!!msg.over);
      if (msg.hint && typeof msg.hint === 'object') this.hint.set(msg.hint);
      if (msg.round) this.round.set(msg.round);
    }
  }

  // ── both ───────────────────────────────────────────────────────────────────

  /** Claims slots. Returns the ones that were still free (the host decides; a guest's claim may be beaten). */
  claim(ids: number[]): number[] {
    if (this.status() !== 'live' || this.over() || !this.round()) return [];
    const free = ids.filter(id => !this.claims().has(id));
    if (!free.length) return [];
    if (this.isHost()) {
      this.applyClaims(this.myId(), free);
    } else if (this.hostConn?.open) {
      // optimistic: show it as mine until the host's state says otherwise
      const next = new Map(this.claims());
      for (const id of free) next.set(id, this.myId());
      this.claims.set(next);
      this.hostConn.send({ t: 'claim', ids: free } satisfies Msg);
    }
    return free;
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

  private clean(name: string): string { return (name ?? '').trim().slice(0, 20) || 'Player'; }
}
