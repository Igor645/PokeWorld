import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Inject, OnDestroy, OnInit,
  PLATFORM_ID, ViewChild, effect, inject, untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { FormsModule } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { Subscription, forkJoin } from 'rxjs';

import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';
import { PokemonService } from '../../services/pokemon.service';
import { PokemonUtilsService } from '../../utils/pokemon-utils';
import { SettingsService } from '../../services/settings.service';
import { PokemonSpecies } from '../../models/pokemon-species.model';
import { Pokemon } from '../../models/pokemon.model';
import { QuizAudio } from '../quiz/quiz-audio';
import { launchConfetti } from '../quiz/quiz-confetti';
import { PokeleVersusService } from './pokele-versus.service';
import { Attr, EMOJI, TILE_KEYS, TILE_LABEL, TYPE_COLORS, Tile, TileKey, buildAttrs, cap, compare, dayKey, hashString, pattern } from './pokele-data';

type Mode = 'daily' | 'free' | 'versus';

interface GuessRow {
  id: number;
  name: string;
  sprite: string;
  correct: boolean;
  tiles: Tile[];
  vals: Record<TileKey, string>;
  types: string[];
}

interface DailySave { date: string; ids: number[]; wrong: number; }

const GEN_ROMAN:  Record<number, string> = { 1:'I', 2:'II', 3:'III', 4:'IV', 5:'V', 6:'VI', 7:'VII', 8:'VIII', 9:'IX' };
const STATS_KEY = 'pw-pokele-v1';
const DAILY_KEY = 'pw-pokele-daily-v1';

@Component({
  selector: 'app-pokele',
  standalone: true,
  imports: [FormsModule, MatIcon, LoadingSpinnerComponent],
  providers: [PokeleVersusService],
  templateUrl: './pokele.component.html',
  styleUrls: ['./pokele.component.css', './pokele-clues.css', './pokele-versus.css', './pokele-play.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PokeleComponent implements OnInit, OnDestroy {
  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement>;
  @ViewChild('confettiEl') confettiEl?: ElementRef<HTMLCanvasElement>;

  readonly vs = inject(PokeleVersusService);

  mode: Mode = 'daily';
  isLoading = true;
  detailsLoading = false;
  wrongCount = 0;
  solved = false;
  guesses: GuessRow[] = [];
  inputValue = '';
  suggestions: PokemonSpecies[] = [];
  showSuggestions = false;
  activeIndex = -1;
  genFilter: number | null = null;
  streak = 0;
  bestStreak = 0;
  muted = false;
  copied = false;
  crying = false;
  notice = '';

  // multiplayer
  playerName = '';
  roomInput = '';
  /** in versus mode with nothing to play yet (no room, or the host has not started a round) */
  waiting = true;

  basicTarget: PokemonSpecies | null = null;
  fullTarget:  PokemonSpecies | null = null;
  dexText = '';
  dexLoading = false;

  // 7 lives, 6 clues: every life lost unlocks the next clue
  readonly MAX_WRONG = 7;
  readonly availableGenerations = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  readonly genRomanMap = GEN_ROMAN;
  readonly livesArray = Array.from({ length: 7 }, (_, i) => i);
  readonly tileKeys = TILE_KEYS;
  readonly tileLabel = TILE_LABEL;

  /** The six clues in unlock order; `span` is the width in the six-column clue grid. */
  readonly hintSlots = [
    { n: 1, icon: 'menu_book',   label: 'Pokédex entry', span: 6 },
    { n: 2, icon: 'volume_up',   label: 'Cry',           span: 2 },
    { n: 3, icon: 'bar_chart',   label: 'Base stats',    span: 4 },
    { n: 4, icon: 'abc',         label: 'First letter',  span: 2 },
    { n: 5, icon: 'explore',     label: 'Origins',       span: 2 },
    { n: 6, icon: 'contrast',    label: 'Silhouette',    span: 2 },
  ];

  get gameOver():  boolean { return this.wrongCount >= this.MAX_WRONG && !this.solved; }
  get active():    boolean { return !!this.basicTarget && !this.solved && !this.gameOver && !this.waiting; }
  get finished():  boolean { return this.solved || this.gameOver; }
  get livesLeft(): number  { return this.MAX_WRONG - this.wrongCount; }
  get unlockedCount(): number { return this.hintSlots.filter(h => this.hintOpen(h.n)).length; }
  get showHint6(): boolean { return this.hintOpen(6); }
  get canBuyClue(): boolean { return this.active && this.unlockedCount < 6 && this.livesLeft > 1; }
  get target(): PokemonSpecies | null { return this.fullTarget ?? this.basicTarget; }
  get targetPokemon(): Pokemon | null {
    const sp = this.target;
    return sp?.pokemons?.find(p => p.is_default) ?? sp?.pokemons?.[0] ?? null;
  }
  get today(): string { return dayKey(); }

  hintOpen(n: number): boolean { return this.wrongCount >= n || this.finished; }

  private attrs = new Map<number, Attr>();
  private allSpecies: PokemonSpecies[] = [];
  private nameMap = new Map<string, PokemonSpecies>();
  private spriteStyleSub?: Subscription;
  private langSub?: Subscription;
  private startedAt = Date.now();
  private lastRoundN = 0;
  private stopConfetti: (() => void) | null = null;
  private noticeRef: ReturnType<typeof setTimeout> | null = null;
  private cryAudio: HTMLAudioElement | null = null;
  private readonly audio = new QuizAudio();
  private readonly browser: boolean;

  constructor(
    private pokemonService: PokemonService,
    private pokemonUtils: PokemonUtilsService,
    private settings: SettingsService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.browser = isPlatformBrowser(platformId);
    // a new round announced by the host (or by ourselves as host) starts the same Pokémon for everyone
    effect(() => {
      const round = this.vs.round();
      untracked(() => this.onRound(round));
    });
    effect(() => {
      this.vs.players();
      this.vs.over();
      this.vs.status();
      untracked(() => this.cdr.markForCheck());
    });
  }

  ngOnInit(): void {
    this.loadStats();
    this.spriteStyleSub = this.settings.watchSetting<string>('spriteStyle').subscribe(() => this.cdr.markForCheck());
    this.langSub = this.pokemonUtils.watchLanguageChanges().subscribe(() => { this.buildNameMap(); this.cdr.markForCheck(); });
    forkJoin({ species: this.pokemonService.getAllPokemonSpecies(), attrs: this.pokemonService.getPokeleAttributes() })
      .subscribe(({ species, attrs }) => {
        this.allSpecies = species.pokemonspecies;
        this.attrs = buildAttrs(attrs);
        this.buildNameMap();
        this.isLoading = false;
        const room = this.browser ? new URLSearchParams(location.search).get('room') : null;
        if (room) {
          this.roomInput = room.toUpperCase();
          this.setMode('versus');
          if (this.playerName) void this.joinRoom();
        } else {
          this.setMode('daily');
        }
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.spriteStyleSub?.unsubscribe();
    this.langSub?.unsubscribe();
    this.stopConfetti?.();
    this.audio.dispose();
    this.cryAudio?.pause();
    if (this.noticeRef) clearTimeout(this.noticeRef);
  }

  // ── modes ───────────────────────────────────────────────────────────────────

  setMode(m: Mode): void {
    if (this.mode === m && this.basicTarget && m !== 'versus') return;
    this.mode = m;
    this.stopConfetti?.();
    if (m === 'daily') this.startDaily();
    else if (m === 'free') this.newFreeGame();
    else {
      // multiplayer: nothing to play until a round is on
      this.waiting = !this.vs.round();
      if (this.vs.round()) this.lastRoundN = 0;
      const r = this.vs.round();
      if (r) this.onRound(r);
      else { this.basicTarget = null; this.fullTarget = null; this.guesses = []; this.wrongCount = 0; this.solved = false; }
    }
    this.cdr.markForCheck();
  }

  private pool(): PokemonSpecies[] {
    return this.genFilter ? this.allSpecies.filter(sp => sp.generation?.id === this.genFilter) : this.allSpecies;
  }

  newFreeGame(): void {
    const pool = this.pool();
    if (!pool.length) return;
    this.waiting = false;
    this.beginGame(pool[Math.floor(Math.random() * pool.length)]);
  }

  newGame(): void {
    if (this.mode === 'free') this.newFreeGame();
    else if (this.mode === 'daily') this.setMode('free');
  }

  setGenFilter(g: number | null): void {
    this.genFilter = g;
    if (this.mode === 'free') this.newFreeGame();
  }

  private startDaily(): void {
    if (!this.allSpecies.length) return;
    this.waiting = false;
    const target = this.allSpecies[hashString(dayKey()) % this.allSpecies.length];
    this.beginGame(target);
    const saved = this.loadDaily();
    if (saved) {
      for (const id of saved.ids) {
        const sp = this.allSpecies.find(s => s.id === id);
        if (sp) this.guesses = [this.makeRow(sp), ...this.guesses];
      }
      this.wrongCount = saved.wrong;
      this.solved = this.guesses.some(g => g.correct);
    }
  }

  /** Multiplayer round from the host: everybody plays the same Pokémon. */
  private onRound(round: { n: number; targetId: number; pool: number | null } | null): void {
    if (!round || this.mode !== 'versus' || round.n === this.lastRoundN || !this.allSpecies.length) return;
    const sp = this.allSpecies.find(s => s.id === round.targetId);
    if (!sp) return;
    this.lastRoundN = round.n;
    this.waiting = false;
    this.genFilter = round.pool;
    this.beginGame(sp);
    this.reportProgress();
    this.cdr.markForCheck();
  }

  private beginGame(seed: PokemonSpecies): void {
    this.stopConfetti?.();
    this.basicTarget = seed;
    this.fullTarget = null;
    this.wrongCount = 0;
    this.solved = false;
    this.guesses = [];
    this.inputValue = '';
    this.suggestions = [];
    this.showSuggestions = false;
    this.dexText = '';
    this.dexLoading = true;
    this.detailsLoading = true;
    this.crying = false;
    this.startedAt = Date.now();
    this.cdr.markForCheck();

    this.pokemonService.getPokemonDetails(seed.id).subscribe(res => {
      if (this.basicTarget !== seed) return;
      this.fullTarget = res.pokemonspecies[0] ?? null;
      this.detailsLoading = false;
      this.cdr.markForCheck();
      setTimeout(() => this.inputEl?.nativeElement.focus(), 0);
    });
    const lang = this.settings.getSetting<number>('selectedLanguageId') || 9;
    this.pokemonService.getPokeleFlavor(seed.id, lang).subscribe(rows => {
      if (this.basicTarget !== seed) return;
      const mine = rows.filter(r => r.language_id === lang);
      const list = (mine.length ? mine : rows).map(r => r.flavor_text);
      this.dexText = list.length ? this.redact(list[hashString(String(seed.id)) % list.length], seed) : '';
      this.dexLoading = false;
      this.cdr.markForCheck();
    });
  }

  /** Blanks out every spelling of the Pokémon's own name in a Pokédex entry. */
  private redact(text: string, sp: PokemonSpecies): string {
    const names = new Set<string>([this.spName(sp), sp.name ?? '', (sp.name ?? '').replace(/-/g, ' ')]);
    for (const n of sp.pokemonspeciesnames ?? []) if (n.name) names.add(n.name);
    let out = text.replace(/[\n\f\r]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    for (const n of [...names].filter(x => x.length > 1).sort((a, b) => b.length - a.length)) {
      out = out.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '▇▇▇▇▇');
    }
    return out;
  }

  // ── guessing ────────────────────────────────────────────────────────────────

  private buildNameMap(): void {
    this.nameMap.clear();
    for (const sp of this.allSpecies) {
      const loc = this.pokemonUtils.getLocalizedNameFromEntity(sp, 'pokemonspeciesnames');
      if (loc && loc !== 'Unknown') this.nameMap.set(this.norm(loc), sp);
      if (sp.name) this.nameMap.set(this.norm(sp.name.replace(/-/g, ' ')), sp);
    }
  }

  onInput(): void {
    const key = this.norm(this.inputValue);
    if (!key) { this.suggestions = []; this.showSuggestions = false; this.activeIndex = -1; return; }
    this.suggestions = this.allSpecies.filter(sp => {
      const loc  = this.norm(this.pokemonUtils.getLocalizedNameFromEntity(sp, 'pokemonspeciesnames'));
      const slug = this.norm(sp.name?.replace(/-/g, ' ') ?? '');
      return loc.startsWith(key) || slug.startsWith(key);
    }).slice(0, 8);
    this.activeIndex = -1;
    this.showSuggestions = this.suggestions.length > 0;
    this.cdr.markForCheck();
  }

  onKeydown(e: KeyboardEvent): void {
    if (this.showSuggestions && this.suggestions.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.activeIndex = Math.min(this.activeIndex + 1, this.suggestions.length - 1);
        this.cdr.detectChanges();
        this.scrollActiveSuggestion();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.activeIndex = Math.max(this.activeIndex - 1, -1);
        this.cdr.detectChanges();
        this.scrollActiveSuggestion();
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && this.activeIndex >= 0) {
        e.preventDefault();
        this.selectSuggestion(this.suggestions[this.activeIndex]);
        return;
      }
      if (e.key === 'Escape') {
        this.showSuggestions = false;
        this.activeIndex = -1;
        this.cdr.detectChanges();
        return;
      }
    }
    if (e.key === 'Enter') this.trySubmit();
  }

  private scrollActiveSuggestion(): void {
    if (this.activeIndex < 0) return;
    setTimeout(() => {
      const item = document.querySelectorAll('.suggestions-drop .sug-item')[this.activeIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }

  onBlur(): void { setTimeout(() => { this.showSuggestions = false; this.activeIndex = -1; this.cdr.markForCheck(); }, 150); }

  selectSuggestion(sp: PokemonSpecies): void {
    this.showSuggestions = false;
    this.activeIndex = -1;
    this.submitGuess(sp);
  }

  private trySubmit(): void {
    const sp = this.nameMap.get(this.norm(this.inputValue));
    if (sp) this.submitGuess(sp);
  }

  private makeRow(sp: PokemonSpecies): GuessRow {
    const g = this.attrs.get(sp.id);
    const t = this.basicTarget ? this.attrs.get(this.basicTarget.id) : undefined;
    const vals = {
      gen: g ? (GEN_ROMAN[g.gen] ?? '?') : '?',
      type: g ? g.types.map(cap).join(' / ') : '?',
      color: g ? cap(g.color) : '?',
      stage: g ? String(g.stage) : '?',
      height: g ? `${(g.height / 10).toFixed(1)} m` : '?',
      weight: g ? `${(g.weight / 10).toFixed(1)} kg` : '?',
      cls: g?.cls ?? '?',
    } as Record<TileKey, string>;
    return {
      id: sp.id,
      name: this.spName(sp),
      sprite: this.spriteUrl(sp),
      correct: sp.id === this.basicTarget?.id,
      tiles: g && t ? compare(g, t) : [],
      vals,
      types: g?.types ?? [],
    };
  }

  private submitGuess(sp: PokemonSpecies): void {
    if (!this.basicTarget || !this.active) return;
    this.inputValue = '';
    this.suggestions = [];
    this.showSuggestions = false;
    if (this.guesses.some(g => g.id === sp.id)) {
      this.flash(`${this.spName(sp)} was already guessed`);
      this.audio.already();
      this.cdr.markForCheck();
      return;
    }
    const row = this.makeRow(sp);
    this.guesses = [row, ...this.guesses];
    if (row.correct) {
      this.solved = true;
      this.onWin();
    } else {
      const before = this.unlockedCount;
      this.wrongCount = Math.min(this.wrongCount + 1, this.MAX_WRONG);
      if (this.gameOver) this.onLose();
      else if (this.unlockedCount > before) this.audio.milestone();
      else this.audio.already();
    }
    this.afterChange();
  }

  /** Costs a life, unlocks the next clue straight away. */
  buyClue(): void {
    if (!this.canBuyClue) return;
    this.wrongCount++;
    this.audio.milestone();
    this.afterChange();
  }

  private onWin(): void {
    if (this.mode !== 'versus') {
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.saveStats();
    }
    this.audio.victory();
    setTimeout(() => {
      const canvas = this.confettiEl?.nativeElement;
      if (canvas) this.stopConfetti = launchConfetti(canvas, Object.values(TYPE_COLORS));
    }, 350);
  }

  private onLose(): void {
    if (this.mode !== 'versus') { this.streak = 0; this.saveStats(); }
    this.audio.giveUp();
  }

  private afterChange(): void {
    this.saveDaily();
    this.reportProgress();
    this.cdr.markForCheck();
  }

  private reportProgress(): void {
    if (this.mode !== 'versus') return;
    const done = this.solved ? 'won' : this.gameOver ? 'lost' : null;
    this.vs.sendProgress(
      [...this.guesses].reverse().map(g => (g.tiles.length ? pattern(g.tiles) : g.correct ? 'ggggggg' : 'nnnnnnn')),
      this.livesLeft, done, done ? Date.now() - this.startedAt : null,
    );
  }

  private flash(message: string): void {
    this.notice = message;
    if (this.noticeRef) clearTimeout(this.noticeRef);
    this.noticeRef = setTimeout(() => { this.notice = ''; this.cdr.markForCheck(); }, 2200);
  }

  // ── multiplayer ─────────────────────────────────────────────────────────────

  async createRoom(): Promise<void> {
    this.saveStats();
    await this.vs.create(this.playerName);
  }

  async joinRoom(): Promise<void> {
    this.saveStats();
    await this.vs.join(this.roomInput, this.playerName);
  }

  leaveRoom(): void {
    this.vs.leave();
    this.lastRoundN = 0;
    this.waiting = true;
    this.basicTarget = null;
    this.fullTarget = null;
    this.guesses = [];
    this.wrongCount = 0;
    this.solved = false;
    this.cdr.markForCheck();
  }

  /** Host: everyone gets the same random Pokémon from the chosen pool. */
  startVersusRound(): void {
    const pool = this.pool();
    if (!pool.length) return;
    this.vs.startRound(pool[Math.floor(Math.random() * pool.length)].id, this.genFilter);
  }

  rename(): void {
    this.saveStats();
    if (this.vs.status() === 'live') this.vs.setName(this.playerName);
  }

  roomLink(): string {
    return this.browser ? `${location.origin}/pokele?room=${this.vs.code()}` : '';
  }

  async copyRoomLink(): Promise<void> {
    try { await navigator.clipboard.writeText(this.roomLink()); this.flash('Invite link copied'); } catch { this.flash(this.roomLink()); }
    this.cdr.markForCheck();
  }

  /** Scoreboard order: points, then who finished this round first. */
  get standings() {
    return [...this.vs.players()].sort((a, b) => b.points - a.points || (a.elapsed ?? Infinity) - (b.elapsed ?? Infinity));
  }

  isMe(id: string): boolean { return id === this.vs.myId(); }

  statusOf(p: { done: 'won' | 'lost' | null; rows: string[]; lives: number }): string {
    if (p.done === 'won') return 'Solved';
    if (p.done === 'lost') return 'Out of lives';
    return p.rows.length ? `${p.rows.length} guess${p.rows.length === 1 ? '' : 'es'}` : 'Thinking…';
  }

  seconds(ms: number | null): string { return ms === null ? '' : `${(ms / 1000).toFixed(1)}s`; }

  cells(row: string): string[] { return row.split(''); }

  // ── daily persistence + sharing ─────────────────────────────────────────────

  private loadDaily(): DailySave | null {
    if (!this.browser) return null;
    try {
      const s = JSON.parse(localStorage.getItem(DAILY_KEY) ?? 'null') as DailySave | null;
      return s && s.date === dayKey() && Array.isArray(s.ids) ? s : null;
    } catch { return null; }
  }

  private saveDaily(): void {
    if (!this.browser || this.mode !== 'daily') return;
    try {
      localStorage.setItem(DAILY_KEY, JSON.stringify({ date: dayKey(), ids: [...this.guesses].reverse().map(g => g.id), wrong: this.wrongCount } satisfies DailySave));
    } catch { /* blocked storage */ }
  }

  shareText(): string {
    const head = `Pokéle ${this.mode === 'daily' ? dayKey() : '(free play)'} — ${this.solved ? `solved in ${this.guesses.length}` : 'not this time'} · ${this.livesLeft}/${this.MAX_WRONG} lives`;
    const rows = [...this.guesses].reverse().map(g => pattern(g.tiles).split('').map(c => EMOJI[c]).join(''));
    return [head, ...rows].join('\n');
  }

  async copyShare(): Promise<void> {
    try { await navigator.clipboard.writeText(this.shareText()); this.copied = true; } catch { this.copied = false; this.flash('Could not copy'); }
    setTimeout(() => { this.copied = false; this.cdr.markForCheck(); }, 2200);
    this.cdr.markForCheck();
  }

  // ── sound + stats ───────────────────────────────────────────────────────────

  toggleMute(): void {
    this.muted = !this.muted;
    this.audio.muted = this.muted;
    this.saveStats();
    if (!this.muted) this.audio.correct();
    this.cdr.markForCheck();
  }

  private loadStats(): void {
    if (!this.browser) return;
    try {
      const s = JSON.parse(localStorage.getItem(STATS_KEY) ?? '{}');
      this.streak = Number(s.streak) || 0;
      this.bestStreak = Number(s.best) || 0;
      this.muted = !!s.muted;
      this.audio.muted = this.muted;
      this.playerName = typeof s.name === 'string' ? s.name : '';
    } catch { /* blocked or corrupt storage */ }
  }

  private saveStats(): void {
    if (!this.browser) return;
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify({ streak: this.streak, best: this.bestStreak, muted: this.muted, name: this.playerName }));
    } catch { /* ignore */ }
  }

  // ── display helpers ─────────────────────────────────────────────────────────

  spName(sp: PokemonSpecies): string {
    return this.pokemonUtils.getLocalizedNameFromEntity(sp, 'pokemonspeciesnames');
  }

  targetName(): string { return this.basicTarget ? this.spName(this.basicTarget) : '???'; }

  /** The name as letter boxes; letters appear as clues unlock (first letter, then the last) and on reveal. */
  nameSlots(): Array<{ ch: string; show: boolean; sep: boolean }> {
    const chars = [...this.targetName()];
    return chars.map((ch, i) => {
      const sep = !/[\p{L}\p{N}]/u.test(ch);
      const show = sep || this.finished || (i === 0 && this.hintOpen(4)) || (i === chars.length - 1 && this.hintOpen(6));
      return { ch, show, sep };
    });
  }

  firstLetter(): string { return [...this.targetName()][0] ?? '?'; }

  /** Colour of the mystery orb: the Pokémon's primary type once it is revealed, the site accent before. */
  revealColor(): string {
    if (!this.finished) return 'var(--primary-color)';
    const name = this.targetPokemon?.pokemontypes?.[0]?.type?.name;
    return (name && TYPE_COLORS[name]) || 'var(--primary-color)';
  }

  typeColor(name: string): string { return TYPE_COLORS[name] || '#888'; }
  typeIcon(name: string): string { return `/images/type-icons/${name}.svg`; }
  typeCap(name: string): string { return cap(name); }

  targetAttr(): Attr | undefined { return this.basicTarget ? this.attrs.get(this.basicTarget.id) : undefined; }
  originLine(kind: 'habitat' | 'shape' | 'eggs'): string {
    const a = this.targetAttr();
    if (!a) return '—';
    if (kind === 'eggs') return a.eggs.length ? a.eggs.map(cap).join(' · ') : '—';
    return cap(a[kind]);
  }

  playCry(): void {
    const id = this.targetPokemon?.id ?? this.basicTarget?.id;
    if (!id || !this.browser) return;
    this.cryAudio?.pause();
    const a = new Audio(`https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${id}.ogg`);
    a.volume = 0.6;
    this.cryAudio = a;
    this.crying = true;
    const stop = () => { this.crying = false; this.cdr.markForCheck(); };
    a.addEventListener('ended', stop);
    a.addEventListener('error', () => { stop(); this.flash('Could not load the cry'); });
    void a.play().catch(stop);
    this.cdr.markForCheck();
  }

  sortedStats() {
    return [...(this.targetPokemon?.pokemonstats ?? [])].sort((a, b) => a.stat.id - b.stat.id);
  }
  bst(): number { return this.targetPokemon?.pokemonstats?.reduce((s, st) => s + st.base_stat, 0) ?? 0; }
  statAbbr(name: string): string {
    const map: Record<string, string> = {
      'hp': 'HP', 'attack': 'ATK', 'defense': 'DEF',
      'special-attack': 'SP.A', 'special-defense': 'SP.D', 'speed': 'SPD',
    };
    return map[name] ?? name.slice(0, 3).toUpperCase();
  }

  targetSpriteUrl(): string {
    const p = this.basicTarget?.pokemons?.find(x => x.is_default) ?? this.basicTarget?.pokemons?.[0];
    return p ? this.spriteFor(p) : '';
  }

  spriteUrl(sp: PokemonSpecies): string {
    const p = sp.pokemons?.find(x => x.is_default) ?? sp.pokemons?.[0];
    return p ? this.spriteFor(p) : '';
  }

  private spriteFor(p: Pokemon): string {
    return this.pokemonUtils.getPokemonOfficialImage(p) || '';
  }

  private norm(s: string): string {
    return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  }
}
