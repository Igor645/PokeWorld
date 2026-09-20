import { Injectable, PLATFORM_ID, effect, inject, signal, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { DataConnection, Peer } from 'peerjs';
import { Run } from '../models';
import { readJson, writeJson } from './gql';
import { NuzlockeStore } from './nuzlocke.store';

type Msg = { t: 'hi'; name: string } | { t: 'run'; run: Run; name: string };
export type SyncStatus = 'off' | 'connecting' | 'live' | 'error';

const hostId = (key: string) => `nzpw-${key}`;
const ME_KEY = 'pw-nz-me-v1';

/**
 * Live co-editing over WebRTC (PeerJS). There is no backend: whoever opens a shared run first claims the room's
 * peer id and acts as the hub, everyone else connects to it. Every copy stays a full local run and copies are merged
 * per cell (see sync.ts), so it also works when one of you goes offline for a while.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(NuzlockeStore);

  readonly status = signal<SyncStatus>('off');
  readonly error = signal('');
  /** Display names of the co-editors that are connected right now. */
  readonly peers = signal<string[]>([]);
  readonly displayName = signal('');

  private peer: Peer | null = null;
  private readonly conns = new Map<string, DataConnection>();
  private readonly names = new Map<string, string>();
  private key: string | null = null;
  private generation = 0;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private push: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (!this.browser) return;
    this.displayName.set(readJson<string>(ME_KEY) ?? '');
    effect(() => {
      const key = this.store.run()?.share?.key ?? null;
      untracked(() => (key ? void this.start(key) : this.stop()));
    });
    effect(() => {
      const r = this.store.run();
      if (r?.share) untracked(() => this.schedulePush());
    });
  }

  setName(name: string): void {
    this.displayName.set(name);
    writeJson(ME_KEY, name);
    this.broadcast({ t: 'hi', name: this.myName() });
  }

  private myName(): string { return this.displayName().trim() || 'Someone'; }

  // ── connection lifecycle ───────────────────────────────────────────────────

  private async start(key: string): Promise<void> {
    if (this.key === key && this.peer) return;
    this.stop();
    this.key = key;
    const gen = ++this.generation;
    this.status.set('connecting');
    this.error.set('');
    try {
      const { Peer } = await import('peerjs');
      if (gen !== this.generation) return;
      this.claimRoom(Peer, key, gen);
    } catch {
      if (gen === this.generation) { this.status.set('error'); this.error.set('Could not load the sync library.'); }
    }
  }

  private claimRoom(PeerCtor: typeof Peer, key: string, gen: number): void {
    const peer = new PeerCtor(hostId(key));
    this.peer = peer;
    peer.on('open', () => { if (gen === this.generation) this.status.set('live'); });
    peer.on('connection', conn => this.attach(conn, gen));
    peer.on('disconnected', () => { if (gen === this.generation && !peer.destroyed) peer.reconnect(); });
    peer.on('error', err => {
      if (gen !== this.generation) return;
      if (err.type === 'unavailable-id') { peer.destroy(); this.joinRoom(PeerCtor, key, gen); return; }
      this.fail(`Sync connection problem (${err.type}). Retrying…`, () => void this.restart(key));
    });
  }

  private joinRoom(PeerCtor: typeof Peer, key: string, gen: number): void {
    const peer = new PeerCtor();
    this.peer = peer;
    peer.on('open', () => {
      if (gen !== this.generation) return;
      const conn = peer.connect(hostId(key), { reliable: true });
      this.attach(conn, gen);
    });
    peer.on('error', err => {
      if (gen !== this.generation) return;
      // The hub went away between our check and the connect: try to become the hub ourselves.
      if (err.type === 'peer-unavailable') { peer.destroy(); this.later(() => void this.restart(key), 1200); return; }
      this.fail(`Sync connection problem (${err.type}). Retrying…`, () => void this.restart(key));
    });
    peer.on('disconnected', () => { if (gen === this.generation && !peer.destroyed) peer.reconnect(); });
  }

  private attach(conn: DataConnection, gen: number): void {
    const onOpen = () => {
      if (gen !== this.generation) { conn.close(); return; }
      this.conns.set(conn.peer, conn);
      this.status.set('live');
      conn.send({ t: 'hi', name: this.myName() } satisfies Msg);
      this.sendRun(conn);
      this.updatePeers();
    };
    if (conn.open) onOpen(); else conn.on('open', onOpen);
    conn.on('data', data => this.receive(conn, data as Msg));
    const gone = () => {
      this.conns.delete(conn.peer);
      this.names.delete(conn.peer);
      this.updatePeers();
      // A guest that lost its hub tries to take over the room (or reconnect to whoever did).
      if (gen === this.generation && this.key && this.conns.size === 0 && this.peer && !this.isHub()) this.later(() => void this.restart(this.key!), 1500);
    };
    conn.on('close', gone);
    conn.on('error', gone);
  }

  private isHub(): boolean { return this.peer?.id === hostId(this.key ?? ''); }

  private async restart(key: string): Promise<void> {
    if (this.key !== key) return;
    this.stop();
    await this.start(key);
  }

  private later(fn: () => void, ms: number): void {
    if (this.retry) clearTimeout(this.retry);
    this.retry = setTimeout(fn, ms);
  }

  private fail(message: string, retry: () => void): void {
    this.status.set('error');
    this.error.set(message);
    this.later(retry, 5000);
  }

  stop(): void {
    this.generation++;
    if (this.retry) clearTimeout(this.retry);
    if (this.push) clearTimeout(this.push);
    for (const c of this.conns.values()) c.close();
    this.conns.clear();
    this.names.clear();
    this.peer?.destroy();
    this.peer = null;
    this.key = null;
    this.status.set('off');
    this.error.set('');
    this.peers.set([]);
  }

  // ── messages ───────────────────────────────────────────────────────────────

  private receive(conn: DataConnection, msg: Msg): void {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'hi' && typeof msg.name === 'string') {
      this.names.set(conn.peer, msg.name.slice(0, 40));
      this.updatePeers();
    } else if (msg.t === 'run' && this.isRunLike(msg.run)) {
      if (typeof msg.name === 'string') this.names.set(conn.peer, msg.name.slice(0, 40));
      const local = this.store.run();
      // Only ever merge into the run that owns this room, and only when the secret matches.
      if (local?.share && msg.run.share?.key === local.share.key && msg.run.id === local.id) this.store.applyRemote(msg.run);
      this.updatePeers();
    }
  }

  private isRunLike(r: unknown): r is Run {
    const x = r as Run;
    return !!x && typeof x === 'object' && typeof x.id === 'string' && typeof x.game === 'string'
      && typeof x.areas === 'object' && x.areas !== null && typeof x.bosses === 'object' && x.bosses !== null;
  }

  private updatePeers(): void {
    this.peers.set([...this.conns.keys()].map(id => this.names.get(id) ?? 'Someone'));
  }

  private sendRun(conn: DataConnection): void {
    const run = this.store.run();
    if (run?.share && conn.open) conn.send({ t: 'run', run, name: this.myName() } satisfies Msg);
  }

  private broadcast(msg: Msg): void {
    for (const c of this.conns.values()) if (c.open) c.send(msg);
  }

  private schedulePush(): void {
    if (this.push) clearTimeout(this.push);
    this.push = setTimeout(() => { for (const c of this.conns.values()) this.sendRun(c); }, 150);
  }

  // ── joining a run someone else shared ──────────────────────────────────────

  /** Connects with a share code, downloads the run and stores it locally. Resolves with the run id. */
  async join(code: string): Promise<string> {
    const key = code.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key.length < 8) throw new Error('That code looks too short.');
    const { Peer: PeerCtor } = await import('peerjs');
    return new Promise<string>((resolve, reject) => {
      const peer = new PeerCtor();
      const done = (fn: () => void) => { clearTimeout(timer); peer.destroy(); fn(); };
      const timer = setTimeout(() => done(() => reject(new Error('Nobody answered. Is the other player online with the run open?'))), 12000);
      peer.on('error', err => done(() => reject(new Error(err.type === 'peer-unavailable'
        ? 'Nobody answered. Is the other player online with the run open?' : `Connection problem (${err.type}).`))));
      peer.on('open', () => {
        const conn = peer.connect(hostId(key), { reliable: true });
        conn.on('data', data => {
          const msg = data as Msg;
          if (msg?.t === 'run' && this.isRunLike(msg.run) && msg.run.share?.key === key) {
            const { id } = this.store.applyRemote(msg.run);
            done(() => resolve(id));
          }
        });
      });
    });
  }
}
