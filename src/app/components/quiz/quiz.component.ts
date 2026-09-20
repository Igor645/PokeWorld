import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

import { FormsModule } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { Subscription, forkJoin } from 'rxjs';

import { PokemonService } from '../../services/pokemon.service';
import { PokemonUtilsService } from '../../utils/pokemon-utils';
import { SettingsService } from '../../services/settings.service';
import { PokemonSpecies } from '../../models/pokemon-species.model';
import { Pokemon } from '../../models/pokemon.model';
import { QuizAudio } from './quiz-audio';
import { launchConfetti } from './quiz-confetti';

interface QuizSlot {
  speciesId: number;
  species: PokemonSpecies;
  pokemon: Pokemon;
  cycleableForms: Pokemon[];
  sortKey: number;
  /** Position in the region's own pokédex (Rowlet is #1 in Alola); absent when the region has no single dex. */
  dexNo?: number;
}

interface QuizGroup {
  id: string;
  label: string;
  slots: QuizSlot[];
}

type QuizPhase = 'select-mode' | 'select-gen' | 'select-type' | 'playing';
type PopMenu = 'lang' | 'giveup' | 'restart' | null;

/** The pill under the input: what just happened. */
interface QuizStatus {
  kind: 'ok' | 'dupe' | 'section' | 'milestone' | 'info';
  text: string;
  sub?: string;
  url?: string;
  speciesId?: number;
  seq: number;
}

interface SavedRun { ids: number[]; seconds: number; total: number; }
interface BestRun { count: number; total: number; seconds: number; }
interface QuizStore { runs: Record<string, SavedRun>; best: Record<string, BestRun>; muted: boolean; }

const STORE_KEY = 'pw-quiz-v2';
/** Guesses closer together than this keep the streak counter alive. */
const STREAK_WINDOW_MS = 8000;
/** Typing "mew" on the way to "mewtwo": wait this long before accepting the shorter name. */
const PREFIX_GRACE_MS = 650;

const LANG_DISPLAY: Record<number, string> = {
  3: '한국어', 4: '繁中', 5: 'Français', 6: 'Deutsch',
  7: 'Español', 8: 'Italiano', 9: 'English', 10: 'Čeština',
  11: '日本語', 12: '简中',
};
const LANG_ORDER = [9, 5, 6, 7, 8, 11, 3, 12, 4, 10];

const TYPE_COLORS: Record<string, string> = {
  normal: '#B9B9AA', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
  grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
  ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
  rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746',
  steel: '#B7B7CE', fairy: '#D685AD',
};

const RANKS: Array<{ min: number; title: string; line: string }> = [
  { min: 1,    title: 'Pokémon Master', line: 'Every last one. Professor Oak would be proud.' },
  { min: 0.9,  title: 'Champion',       line: 'Barely a handful escaped you.' },
  { min: 0.7,  title: 'Elite Four',     line: 'A serious Pokédex — a few stragglers left.' },
  { min: 0.5,  title: 'Gym Leader',     line: 'Half the world is in your head. Keep going.' },
  { min: 0.25, title: 'Ace Trainer',    line: 'A solid start, plenty still to discover.' },
  { min: 0,    title: 'Rookie',         line: 'Every Champion started with one Pokémon.' },
];

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [FormsModule, MatIcon],
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.css', './quiz-board.css', './quiz-menu.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizComponent implements OnInit, OnDestroy {
  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement>;
  @ViewChild('confettiEl') confettiEl?: ElementRef<HTMLCanvasElement>;

  quizPhase: QuizPhase = 'select-mode';
  isLoading = true;
  groups: QuizGroup[] = [];
  columns: QuizGroup[][] = [];
  guessedIds = new Set<number>();
  recentlyGuessedId: number | null = null;
  flashId: number | null = null;
  inputValue = '';
  showSilhouettes = false;
  revealed = false;
  totalCount = 0;
  timerSeconds = 0;
  timerStarted = false;
  finished = false;
  cycleIndex = 0;
  availableTypes: { id: number; name: string }[] = [];
  currentFilter: { label: string; typeName?: string } | null = null;
  guessLangIds = new Set<number>();
  availableLangs: { id: number; name: string }[] = [];

  status: QuizStatus | null = null;
  streak = 0;
  openMenu: PopMenu = null;
  showResults = false;
  muted = false;
  collapsed = new Set<string>();
  /** Hide everything already named, leaving only the tiles still to find. */
  onlyMissing = false;

  private allGroups: QuizGroup[] = [];
  private nameMap = new Map<string, PokemonSpecies[]>();
  private groupCounts = new Map<string, number>();
  private completedGroups = new Set<string>();
  private hintCache = new Map<number, string>();
  private modeKey = 'all';
  private store: QuizStore = { runs: {}, best: {}, muted: false };
  private lastGuessAt = 0;
  private statusSeq = 0;
  private timerRef: ReturnType<typeof setInterval> | null = null;
  private cycleRef: ReturnType<typeof setInterval> | null = null;
  private commitRef: ReturnType<typeof setTimeout> | null = null;
  private streakRef: ReturnType<typeof setTimeout> | null = null;
  private popRef: ReturnType<typeof setTimeout> | null = null;
  private flashRef: ReturnType<typeof setTimeout> | null = null;
  private resultsRef: ReturnType<typeof setTimeout> | null = null;
  private stopConfetti: (() => void) | null = null;
  private langSub?: Subscription;
  private spriteStyleSub?: Subscription;
  private readonly audio = new QuizAudio();
  private readonly browser: boolean;

  private readonly REGIONAL_GEN: Record<string, number> = {
    alola: 7, galar: 8, paldea: 9, kitakami: 9,
  };

  private readonly GEN_SORT_DEX: Record<number, number> = {
    1: 2, 2: 7, 3: 15, 4: 6, 5: 8, 6: 0, 7: 21, 8: 27, 9: 31,
  };

  private readonly REGIONAL_SORT_DEX: Record<string, number> = {
    alola: 21, galar: 27, hisui: 30, paldea: 31, kitakami: 32,
  };

  constructor(
    private pokemonService: PokemonService,
    private pokemonUtils: PokemonUtilsService,
    private settings: SettingsService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.browser = isPlatformBrowser(platformId);
  }

  // ── Derived data ──────────────────────────────────────────────────────────────

  get genOptions(): Array<{ id: number | 'hisui'; label: string; roman: string; count: number }> {
    const romanMap: Record<number, string> = {
      1:'I', 2:'II', 3:'III', 4:'IV', 5:'V', 6:'VI', 7:'VII', 8:'VIII', 9:'IX',
    };
    return this.allGroups
      .filter(g => g.id.startsWith('gen-') || g.id === 'hisui')
      .map(g => {
        if (g.id === 'hisui') return { id: 'hisui' as const, label: 'Hisui', roman: '✦', count: g.slots.length };
        const genId = parseInt(g.id.replace('gen-', ''));
        return { id: genId, label: g.label, roman: romanMap[genId] ?? String(genId), count: g.slots.length };
      });
  }

  get allSpeciesCount(): number {
    return new Set(this.allGroups.flatMap(g => g.slots.map(s => s.speciesId))).size;
  }

  get megaCount(): number { return this.allGroups.find(g => g.id === 'mega')?.slots.length ?? 0; }
  get gmaxCount(): number { return this.allGroups.find(g => g.id === 'gmax')?.slots.length ?? 0; }

  get percent(): number { return this.totalCount ? this.guessedIds.size / this.totalCount : 0; }
  get missedCount(): number { return Math.max(0, this.totalCount - this.guessedIds.size); }

  get pace(): string {
    if (!this.timerSeconds || !this.guessedIds.size) return '–';
    return (this.guessedIds.size / (this.timerSeconds / 60)).toFixed(1);
  }

  get rank(): { title: string; line: string } {
    return RANKS.find(r => this.percent >= r.min) ?? RANKS[RANKS.length - 1];
  }

  get resultRows(): Array<{ label: string; got: number; total: number }> {
    return this.groups.map(g => ({ label: g.label, got: this.guessedInGroup(g), total: g.slots.length }));
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadStore();
    this.loadSpecies();
    this.langSub = this.pokemonUtils.watchLanguageChanges().subscribe(langId => {
      this.guessLangIds = new Set([langId]);
      this.buildNameMap();
      this.cdr.detectChanges();
    });
    this.spriteStyleSub = this.settings.watchSetting<string>('quizSpriteStyle').subscribe(() => {
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.persist();
    this.clearTimer();
    this.clearCycle();
    this.clearCommit();
    for (const t of [this.streakRef, this.popRef, this.flashRef, this.resultsRef]) if (t) clearTimeout(t);
    this.stopConfetti?.();
    this.langSub?.unsubscribe();
    this.spriteStyleSub?.unsubscribe();
    this.audio.dispose();
  }

  @HostListener('window:beforeunload')
  onUnload(): void { this.persist(); }

  // ── Persistence ───────────────────────────────────────────────────────────────

  private loadStore(): void {
    if (!this.browser) return;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<QuizStore>;
        this.store = { runs: p.runs ?? {}, best: p.best ?? {}, muted: !!p.muted };
      }
    } catch { /* corrupt or blocked storage: start fresh */ }
    this.muted = this.store.muted;
    this.audio.muted = this.muted;
  }

  private saveStore(): void {
    if (!this.browser) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(this.store)); } catch { /* quota / private mode */ }
  }

  /** Writes the in-progress run (or drops it once it is over / empty). */
  private persist(): void {
    if (this.quizPhase !== 'playing') return;
    if (this.guessedIds.size > 0 && !this.finished && !this.revealed) {
      this.store.runs[this.modeKey] = { ids: [...this.guessedIds], seconds: this.timerSeconds, total: this.totalCount };
    } else {
      delete this.store.runs[this.modeKey];
    }
    this.saveStore();
  }

  private recordBest(): void {
    const prev = this.store.best[this.modeKey];
    const count = this.guessedIds.size;
    const complete = count >= this.totalCount;
    const prevComplete = !!prev && prev.count >= prev.total;
    const better = !prev
      || (complete && (!prevComplete || this.timerSeconds < prev.seconds))
      || (!complete && !prevComplete && count > prev.count);
    if (better) this.store.best[this.modeKey] = { count, total: this.totalCount, seconds: this.timerSeconds };
    delete this.store.runs[this.modeKey];
    this.saveStore();
  }

  /** "In progress" / "Best" summary for a mode, shown on the picker screens. */
  meta(key: string): { resume?: SavedRun; best?: BestRun } {
    return { resume: this.store.runs[key], best: this.store.best[key] };
  }

  toggleMissing(): void {
    this.onlyMissing = !this.onlyMissing;
    this.cdr.detectChanges();
  }

  /** Primary type colour of a slot's form, used for the accent edge of a named tile. */
  slotColor(slot: QuizSlot): string {
    const name = (slot.pokemon as any).pokemontypes?.[0]?.type?.name as string | undefined;
    return name ? this.typeColor(name) : 'transparent';
  }

  toggleGroup(g: QuizGroup): void {
    const next = new Set(this.collapsed);
    if (!next.delete(g.id)) next.add(g.id);
    this.collapsed = next;
    this.cdr.detectChanges();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    this.audio.muted = this.muted;
    this.store.muted = this.muted;
    this.saveStore();
    if (!this.muted) this.audio.correct();
    this.cdr.detectChanges();
  }

  // ── Data loading ──────────────────────────────────────────────────────────────

  private loadSpecies(): void {
    forkJoin({
      species: this.pokemonService.getQuizPokemonSpecies(),
      dex: this.pokemonService.getQuizDexNumbers(),
    }).subscribe(({ species, dex }) => {
      const all = species.pokemonspecies;
      const byId = new Map<number, Array<{ pokedex_id: number; pokedex_number: number }>>();
      for (const d of dex) {
        const list = byId.get(d.pokemon_species_id);
        if (list) list.push(d);
        else byId.set(d.pokemon_species_id, [d]);
      }
      for (const sp of all) if (!sp.pokemondexnumbers?.length) sp.pokemondexnumbers = byId.get(sp.id) ?? [];
      this.buildGroups(all);
      this.extractTypes(all);
      this.deriveAvailableLangs(all);
      this.isLoading = false;
      this.cdr.detectChanges();
    });
  }

  private buildGroups(all: PokemonSpecies[]): void {
    const dexLookup = new Map<number, Map<number, number>>();
    for (const sp of all) {
      const byDex = new Map<number, number>();
      for (const e of sp.pokemondexnumbers ?? []) byDex.set(e.pokedex_id, e.pokedex_number);
      dexLookup.set(sp.id, byDex);
    }

    const genGroupMap = new Map<number, QuizGroup>();
    const getGenGroup = (genId: number): QuizGroup => {
      if (!genGroupMap.has(genId)) {
        genGroupMap.set(genId, { id: `gen-${genId}`, label: this.genLabel(genId), slots: [] });
      }
      return genGroupMap.get(genId)!;
    };

    const hisuiGroup: QuizGroup = { id: 'hisui', label: 'Hisui', slots: [] };
    const megaGroup: QuizGroup  = { id: 'mega',  label: 'Mega Evolutions', slots: [] };
    const gmaxGroup: QuizGroup  = { id: 'gmax',  label: 'Gigantamax', slots: [] };
    const seenPokemonIds = new Set<number>();

    for (const sp of all) {
      if (!sp.generation) continue;
      const c = this.classifyPokemons(sp, seenPokemonIds);
      const spDex = dexLookup.get(sp.id) ?? new Map<number, number>();
      const genId = sp.generation.id;
      const genSortDex = this.GEN_SORT_DEX[genId] ?? 0;

      if (c.defaultPokemon) {
        if (genId === 8 && spDex.has(30)) {
          hisuiGroup.slots.push({
            speciesId: sp.id, species: sp, pokemon: c.defaultPokemon,
            cycleableForms: [c.defaultPokemon, ...c.cosmeticForms],
            sortKey: spDex.get(30) ?? sp.id, dexNo: spDex.get(30),
          });
        } else {
          const sortKey = genSortDex > 0 ? (spDex.get(genSortDex) ?? sp.id * 100000) : sp.id;
          getGenGroup(genId).slots.push({
            speciesId: sp.id, species: sp, pokemon: c.defaultPokemon,
            cycleableForms: [c.defaultPokemon, ...c.cosmeticForms], sortKey,
            dexNo: genSortDex > 0 ? spDex.get(genSortDex) : undefined,
          });
        }
      }

      for (const [suffix, forms] of c.regionals) {
        if (suffix === 'hisui') {
          if (!forms.length) continue;
          hisuiGroup.slots.push({
            speciesId: sp.id, species: sp, pokemon: forms[0],
            cycleableForms: forms, sortKey: spDex.get(30) ?? sp.id, dexNo: spDex.get(30),
          });
          continue;
        }
        const targetGenId = this.REGIONAL_GEN[suffix];
        if (!targetGenId || !forms.length) continue;
        const targetSortDex = this.GEN_SORT_DEX[targetGenId] ?? 0;
        const regionalDexId = this.REGIONAL_SORT_DEX[suffix];
        // Regional forms of older species follow the region's own Pokémon (Rowlet first, not Alolan Rattata).
        const regionalDex = spDex.get(regionalDexId);
        const sortKey = regionalDex === undefined
          ? 1e9 + sp.id
          : regionalDexId === targetSortDex ? regionalDex : regionalDex + 10000;
        getGenGroup(targetGenId).slots.push({
          speciesId: sp.id, species: sp, pokemon: forms[0],
          cycleableForms: forms, sortKey,
          dexNo: regionalDexId === targetSortDex ? regionalDex : undefined,
        });
      }

      for (const mega of c.megas) megaGroup.slots.push(
        { speciesId: sp.id, species: sp, pokemon: mega, cycleableForms: [mega], sortKey: sp.id });
      for (const gmax of c.gmaxs) gmaxGroup.slots.push(
        { speciesId: sp.id, species: sp, pokemon: gmax, cycleableForms: [gmax], sortKey: sp.id });
    }

    for (const g of genGroupMap.values()) g.slots.sort((a, b) => a.sortKey - b.sortKey);
    hisuiGroup.slots.sort((a, b) => a.sortKey - b.sortKey);
    megaGroup.slots.sort((a, b) => a.speciesId - b.speciesId);
    gmaxGroup.slots.sort((a, b) => a.speciesId - b.speciesId);

    const genGroups = [...genGroupMap.values()].sort((a, b) =>
      parseInt(a.id.replace('gen-', '')) - parseInt(b.id.replace('gen-', '')));
    const gen8Idx = genGroups.findIndex(g => g.id === 'gen-8');

    this.allGroups = [
      ...genGroups.slice(0, gen8Idx + 1),
      ...(hisuiGroup.slots.length ? [hisuiGroup] : []),
      ...genGroups.slice(gen8Idx + 1),
      ...(megaGroup.slots.length ? [megaGroup] : []),
      ...(gmaxGroup.slots.length ? [gmaxGroup] : []),
    ];
  }

  private extractTypes(all: PokemonSpecies[]): void {
    const seen = new Map<string, { id: number; name: string }>();
    for (const sp of all) {
      const dp = sp.pokemons?.find(p => p.is_default) ?? sp.pokemons?.[0];
      for (const pt of (dp as any)?.pokemontypes ?? []) {
        if (pt.type?.name && !seen.has(pt.type.name)) {
          seen.set(pt.type.name, { id: pt.type.id, name: pt.type.name });
        }
      }
    }
    this.availableTypes = [...seen.values()].sort((a, b) => a.id - b.id);
  }

  private genLabel(genId: number): string {
    const labels: Record<number, string> = {
      1: 'Kanto', 2: 'Johto', 3: 'Hoenn', 4: 'Sinnoh', 5: 'Unova',
      6: 'Kalos', 7: 'Alola', 8: 'Galar', 9: 'Paldea',
    };
    return labels[genId] ?? `Gen ${genId}`;
  }

  // ── Mode selection ────────────────────────────────────────────────────────────

  selectAll(): void    { this.applyFilter('all'); }
  selectMega(): void   { this.applyFilter('mega'); }
  selectGmax(): void   { this.applyFilter('gmax'); }
  openGenPicker(): void  { this.quizPhase = 'select-gen';  this.cdr.detectChanges(); }
  openTypePicker(): void { this.quizPhase = 'select-type'; this.cdr.detectChanges(); }
  selectGen(id: number | 'hisui'): void { this.applyFilter('gen', id); }
  selectType(name: string): void        { this.applyFilter('type', name); }
  goBack(): void     { this.quizPhase = 'select-mode'; this.cdr.detectChanges(); }

  changeMode(): void {
    this.persist();
    this.clearTimer();
    this.clearCycle();
    this.clearCommit();
    this.openMenu = null;
    this.showResults = false;
    this.quizPhase = 'select-mode';
    this.cdr.detectChanges();
  }

  private applyFilter(kind: string, arg?: any): void {
    let filtered: QuizGroup[];
    switch (kind) {
      case 'all':  filtered = this.allGroups; break;
      case 'mega': filtered = this.allGroups.filter(g => g.id === 'mega'); break;
      case 'gmax': filtered = this.allGroups.filter(g => g.id === 'gmax'); break;
      case 'gen': {
        const gid = arg === 'hisui' ? 'hisui' : `gen-${arg}`;
        filtered = this.allGroups.filter(g => g.id === gid);
        break;
      }
      case 'type': {
        const typeName = arg as string;
        filtered = this.allGroups
          .map(g => ({
            ...g,
            slots: g.slots.filter(s =>
              (s.pokemon as any).pokemontypes?.some((pt: any) => pt.type.name === typeName)
            ),
          }))
          .filter(g => g.slots.length > 0);
        break;
      }
      default: filtered = this.allGroups;
    }

    switch (kind) {
      case 'all':  this.currentFilter = { label: 'All Pokémon' }; break;
      case 'mega': this.currentFilter = { label: 'Mega Evolutions' }; break;
      case 'gmax': this.currentFilter = { label: 'Gigantamax' }; break;
      case 'gen': {
        const gid = arg === 'hisui' ? 'hisui' : `gen-${arg}`;
        const lbl = this.allGroups.find(g => g.id === gid)?.label ?? String(arg);
        this.currentFilter = { label: lbl };
        break;
      }
      case 'type':
        this.currentFilter = { label: this.typeCap(arg as string), typeName: arg as string };
        break;
    }

    this.modeKey    = kind === 'gen' || kind === 'type' ? `${kind}:${arg}` : kind;
    this.groups     = filtered;
    this.totalCount = new Set(filtered.flatMap(g => g.slots.map(s => s.speciesId))).size;
    const colCount  = Math.min(4, Math.max(1, filtered.length));
    this.columns    = this.distributeToColumns(colCount);
    this.buildNameMap();

    this.clearRunState();
    this.resumeSaved();
    this.recount();
    this.completedGroups = new Set(this.groups.filter(g => this.guessedInGroup(g) === g.slots.length).map(g => g.id));
    this.quizPhase = 'playing';
    this.cdr.detectChanges();
    setTimeout(() => this.inputEl?.nativeElement.focus(), 0);
  }

  /** Picks up a saved run for the current mode, if there is one. */
  private resumeSaved(): void {
    const saved = this.store.runs[this.modeKey];
    if (!saved?.ids.length) return;
    const inScope = new Set(this.groups.flatMap(g => g.slots.map(s => s.speciesId)));
    const ids = saved.ids.filter(id => inScope.has(id));
    if (!ids.length || ids.length >= this.totalCount) return;
    this.guessedIds = new Set(ids);
    this.timerSeconds = saved.seconds;
    this.setStatus({ kind: 'info', text: 'Welcome back', sub: `${ids.length} / ${this.totalCount} restored` });
  }

  private clearRunState(): void {
    this.clearTimer();
    this.clearCycle();
    this.clearCommit();
    this.guessedIds        = new Set();
    this.inputValue        = '';
    this.timerSeconds      = 0;
    this.timerStarted      = false;
    this.finished          = false;
    this.showSilhouettes   = false;
    this.revealed          = false;
    this.recentlyGuessedId = null;
    this.flashId           = null;
    this.cycleIndex        = 0;
    this.streak            = 0;
    this.lastGuessAt       = 0;
    this.status            = null;
    this.openMenu          = null;
    this.showResults       = false;
    this.completedGroups   = new Set();
    this.collapsed         = new Set();
    this.stopConfetti?.();
    this.stopConfetti = null;
  }

  // ── Quiz actions ──────────────────────────────────────────────────────────────

  onInput(): void {
    this.clearCommit();
    const key = this.norm(this.inputValue);
    if (!key || !this.nameMap.get(key)?.length) return;
    // "mew" is a real name, but so is "mewtwo": give the player a beat to keep typing
    if (this.hasLongerCandidate(key)) {
      this.commitRef = setTimeout(() => this.commitGuess(), PREFIX_GRACE_MS);
      return;
    }
    this.commitGuess();
  }

  /** Enter accepts the current text immediately, skipping the grace period. */
  onEnter(): void { this.commitGuess(); }

  private commitGuess(): void {
    this.clearCommit();
    if (this.finished || this.revealed) return;
    const key = this.norm(this.inputValue);
    const matches = key ? this.nameMap.get(key) : undefined;
    if (!matches?.length) return;
    this.inputValue = '';

    const unguessed = matches.filter(sp => !this.guessedIds.has(sp.id));
    if (!unguessed.length) { this.onRepeat(matches[0]); return; }

    if (!this.timerStarted) this.startTimer();
    if (!this.cycleRef) this.startCycle();

    const before = this.percent;
    const now = Date.now();
    const step = now - this.lastGuessAt < STREAK_WINDOW_MS ? this.streak : 0;
    this.streak = step + unguessed.length;
    this.lastGuessAt = now;
    if (this.streakRef) clearTimeout(this.streakRef);
    this.streakRef = setTimeout(() => { this.streak = 0; this.cdr.detectChanges(); }, STREAK_WINDOW_MS);

    const next = new Set(this.guessedIds);
    for (const sp of unguessed) next.add(sp.id);
    this.guessedIds = next;
    this.recount();

    const last = unguessed[unguessed.length - 1];
    const dp = last.pokemons?.find(p => p.is_default);
    this.recentlyGuessedId = last.id;
    this.setStatus({
      kind: 'ok', text: this.spName(last), sub: `#${String(last.id).padStart(4, '0')}`,
      url: dp ? this.imageUrl(dp) : '', speciesId: last.id,
    });

    const justDone = this.groups.filter(g => !this.completedGroups.has(g.id) && this.guessedInGroup(g) === g.slots.length);
    for (const g of justDone) this.completedGroups.add(g.id);
    const crossed = this.totalCount >= 40
      && Math.floor(this.percent * 4) > Math.floor(before * 4) && this.percent < 1;

    if (this.guessedIds.size >= this.totalCount) {
      this.finish();
    } else if (justDone.length && this.groups.length > 1) {
      this.audio.sectionDone();
      this.setStatus({ kind: 'section', text: `${justDone[0].label} complete`, sub: `${this.guessedIds.size} / ${this.totalCount}` });
    } else if (crossed) {
      this.audio.milestone();
      const pct = Math.floor(this.percent * 4) * 25;
      this.setStatus({ kind: 'milestone', text: pct === 50 ? 'Halfway there' : `${pct}% named`, sub: `${this.guessedIds.size} / ${this.totalCount}` });
    } else {
      this.audio.correct();
    }

    if (!this.finished) this.persist();
    this.cdr.detectChanges();
    if (this.popRef) clearTimeout(this.popRef);
    this.popRef = setTimeout(() => { this.recentlyGuessedId = null; this.cdr.detectChanges(); }, 900);
  }

  /** Typed something that is already on the board: say so and point at it. */
  private onRepeat(sp: PokemonSpecies): void {
    this.audio.already();
    this.setStatus({ kind: 'dupe', text: `${this.spName(sp)} is already on the board`, speciesId: sp.id });
    this.flashId = sp.id;
    if (this.flashRef) clearTimeout(this.flashRef);
    this.flashRef = setTimeout(() => { this.flashId = null; this.cdr.detectChanges(); }, 1200);
    this.cdr.detectChanges();
  }

  private finish(): void {
    this.finished = true;
    this.clearTimer();
    this.recordBest();
    this.audio.victory();
    this.resultsRef = setTimeout(() => {
      this.showResults = true;
      this.cdr.detectChanges();
      const canvas = this.confettiEl?.nativeElement;
      if (canvas) this.stopConfetti = launchConfetti(canvas, Object.values(TYPE_COLORS));
    }, 1100);
  }

  enableSilhouettes(): void {
    this.showSilhouettes = !this.showSilhouettes;
    this.cdr.detectChanges();
  }

  giveUp(): void {
    this.openMenu = null;
    this.revealed = true;
    this.clearTimer();
    this.clearCommit();
    if (!this.cycleRef) this.startCycle();
    this.recordBest();
    this.audio.giveUp();
    this.showResults = true;
    this.cdr.detectChanges();
  }

  reset(): void {
    this.openMenu = null;
    delete this.store.runs[this.modeKey];
    this.saveStore();
    this.clearRunState();
    this.recount();
    this.cdr.detectChanges();
    setTimeout(() => this.inputEl?.nativeElement.focus(), 0);
  }

  closeResults(): void {
    this.showResults = false;
    this.stopConfetti?.();
    this.stopConfetti = null;
    this.cdr.detectChanges();
  }

  openResults(): void { this.showResults = true; this.cdr.detectChanges(); }

  toggleMenu(m: Exclude<PopMenu, null>): void {
    this.openMenu = this.openMenu === m ? null : m;
    this.cdr.detectChanges();
  }

  // ── Board navigation ──────────────────────────────────────────────────────────

  scrollToGroup(g: QuizGroup): void {
    if (this.collapsed.has(g.id)) this.toggleGroup(g);
    document.getElementById(`grp-${g.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Scrolls the board to where a species lives and pulses it. */
  locate(speciesId: number | undefined): void {
    if (!speciesId) return;
    const hidden = this.groups.filter(g => this.collapsed.has(g.id) && g.slots.some(s => s.speciesId === speciesId));
    if (hidden.length) {
      this.collapsed = new Set([...this.collapsed].filter(id => !hidden.some(g => g.id === id)));
      this.cdr.detectChanges();
    }
    const el = document.querySelector(`[data-sid="${speciesId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.flashId = speciesId;
    if (this.flashRef) clearTimeout(this.flashRef);
    this.flashRef = setTimeout(() => { this.flashId = null; this.cdr.detectChanges(); }, 1400);
    this.cdr.detectChanges();
  }

  openPokemon(slot: QuizSlot): void {
    if (!this.guessedIds.has(slot.speciesId) && !this.revealed) return;
    this.persist();
    void this.router.navigate(['/pokemon', slot.speciesId]);
  }

  // ── Classify helpers ──────────────────────────────────────────────────────────

  private classifyPokemons(sp: PokemonSpecies, seenIds: Set<number>): {
    defaultPokemon: Pokemon | null;
    cosmeticForms: Pokemon[];
    regionals: Map<string, Pokemon[]>;
    megas: Pokemon[];
    gmaxs: Pokemon[];
  } {
    const result = {
      defaultPokemon: null as Pokemon | null,
      cosmeticForms: [] as Pokemon[],
      regionals: new Map<string, Pokemon[]>(),
      megas: [] as Pokemon[],
      gmaxs: [] as Pokemon[],
    };

    const hasSprite = (p: Pokemon): boolean => {
      const s = p.pokemonsprites?.[0]?.sprites;
      return !!(s?.other?.['home']?.front_default || s?.front_default);
    };

    for (const p of sp.pokemons ?? []) {
      if (seenIds.has(p.id)) continue;
      seenIds.add(p.id);
      const n = p.name;
      if (p.is_default) {
        result.defaultPokemon = p;
      } else if (n.includes('-mega')) {
        if (hasSprite(p)) result.megas.push(p);
      } else if (n.includes('-gmax')) {
        if (hasSprite(p)) result.gmaxs.push(p);
      } else {
        const suffix = this.cleanRegionalSuffix(n, sp.name);
        if (suffix) {
          if (!result.regionals.has(suffix)) result.regionals.set(suffix, []);
          if (hasSprite(p)) result.regionals.get(suffix)!.push(p);
        } else if (!n.includes('-totem')) {
          if (hasSprite(p)) result.cosmeticForms.push(p);
        }
      }
    }
    return result;
  }

  private cleanRegionalSuffix(pokemonName: string, speciesName: string): string | null {
    for (const r of ['alola', 'galar', 'hisui', 'paldea', 'kitakami']) {
      const base = `${speciesName}-${r}`;
      if ((pokemonName === base || pokemonName.startsWith(`${base}-`)) && !pokemonName.includes('-cap')) return r;
    }
    return null;
  }

  private distributeToColumns(n: number): QuizGroup[][] {
    const cols: QuizGroup[][] = Array.from({ length: n }, () => []);
    const total = this.groups.reduce((sum, g) => sum + g.slots.length, 0);
    const target = total / n;
    let colIdx = 0;
    let accumulated = 0;
    for (const g of this.groups) {
      if (colIdx < n - 1 && accumulated >= target) { colIdx++; accumulated = 0; }
      cols[colIdx].push(g);
      accumulated += g.slots.length;
    }
    return cols;
  }

  private buildNameMap(): void {
    this.nameMap.clear();
    this.hintCache.clear();
    const seen = new Set<number>();
    for (const g of this.groups) {
      for (const s of g.slots) {
        if (seen.has(s.speciesId)) continue;
        seen.add(s.speciesId);
        const sp = s.species;
        for (const n of sp.pokemonspeciesnames ?? []) {
          if (this.guessLangIds.has(n.language_id) && n.name) {
            const k = this.norm(n.name);
            const existing = this.nameMap.get(k);
            if (existing) existing.push(sp);
            else this.nameMap.set(k, [sp]);
          }
        }
      }
    }
  }

  /** True when some other, still-unnamed Pokémon has a name that starts with `key`. */
  private hasLongerCandidate(key: string): boolean {
    for (const [k, list] of this.nameMap) {
      if (k.length > key.length && k.startsWith(key) && list.some(sp => !this.guessedIds.has(sp.id))) return true;
    }
    return false;
  }

  toggleLang(id: number): void {
    const next = new Set(this.guessLangIds);
    if (next.has(id) && next.size > 1) next.delete(id);
    else next.add(id);
    this.guessLangIds = next;
    this.buildNameMap();
    this.cdr.detectChanges();
  }

  private deriveAvailableLangs(all: PokemonSpecies[]): void {
    const found = new Set<number>();
    for (const sp of all) {
      for (const n of sp.pokemonspeciesnames ?? []) found.add(n.language_id);
    }
    this.availableLangs = [...found]
      .filter(id => !!LANG_DISPLAY[id])
      .sort((a, b) => {
        const ai = LANG_ORDER.indexOf(a); const bi = LANG_ORDER.indexOf(b);
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      })
      .map(id => ({ id, name: LANG_DISPLAY[id] }));
  }

  private norm(s: string): string {
    return s.toLowerCase().normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  // ── Display helpers ───────────────────────────────────────────────────────────

  currentCycleForm(slot: QuizSlot): Pokemon {
    if (slot.cycleableForms.length <= 1) return slot.pokemon;
    return slot.cycleableForms[(this.cycleIndex + slot.speciesId) % slot.cycleableForms.length];
  }

  imageUrl(pokemon: Pokemon): string {
    const sprites = pokemon.pokemonsprites?.[0]?.sprites;
    const style = this.settings.getSetting<string>('quizSpriteStyle');
    if (style === 'home')  return sprites?.other?.['home']?.front_default || sprites?.other?.['official-artwork']?.front_default || '';
    if (style === 'pixel') return sprites?.front_default || '';
    if (style === 'icons') {
      const v = sprites?.versions;
      return v?.['generation-ix']?.['scarlet-violet']?.front_default
        || v?.['generation-viii']?.['brilliant-diamond-shining-pearl']?.front_default
        || v?.['generation-viii']?.['icons']?.front_default
        || v?.['generation-vii']?.['icons']?.front_default
        || sprites?.front_default
        || '';
    }
    return sprites?.other?.['official-artwork']?.front_default || sprites?.other?.['home']?.front_default || '';
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.showResults) this.closeResults();
      else if (this.openMenu) { this.openMenu = null; this.cdr.detectChanges(); }
      return;
    }
    if (this.quizPhase !== 'playing' || this.finished || this.revealed || this.showResults) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const input = this.inputEl?.nativeElement;
    if (!input || document.activeElement === input) return;
    const tag = (document.activeElement as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key.length === 1) input.focus();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (!this.openMenu) return;
    const el = e.target as HTMLElement | null;
    if (el?.isConnected && !el.closest('.qh-pop-wrap')) {
      this.openMenu = null;
      this.cdr.detectChanges();
    }
  }

  groupLabel(g: QuizGroup): string { return g.label; }

  formName(slot: QuizSlot): string {
    const base = this.spName(slot.species);
    if (slot.pokemon.is_default) return base;
    const speciesParts = slot.species.name.split('-').length;
    const extra = slot.pokemon.name.split('-').slice(speciesParts)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return extra ? `${base} ${extra}` : base;
  }

  spName(sp: PokemonSpecies): string {
    return this.pokemonUtils.getLocalizedNameFromEntity(sp, 'pokemonspeciesnames');
  }

  /** Label of a tile that is not named yet: its regional dex number (national number where the region has none). */
  dexLabel(slot: QuizSlot): string {
    return slot.dexNo !== undefined
      ? String(slot.dexNo).padStart(3, '0')
      : String(slot.speciesId).padStart(4, '0');
  }

  /** Hover text for a slot: the name once known, a letter-count hint while silhouettes are on. */
  tip(slot: QuizSlot): string | null {
    if (this.guessedIds.has(slot.speciesId) || this.revealed) {
      return `${this.formName(slot)} · #${String(slot.speciesId).padStart(4, '0')}`;
    }
    if (!this.showSilhouettes) return null;
    let hint = this.hintCache.get(slot.speciesId);
    if (hint === undefined) {
      const name = this.guessNameOf(slot.species);
      const chars = [...name.replace(/[\s\-.'’:]/g, '')];
      hint = chars.length ? `${chars[0].toUpperCase()} ${chars.slice(1).map(() => '_').join(' ')}`.trim() + `  (${chars.length})` : '';
      this.hintCache.set(slot.speciesId, hint);
    }
    return hint || null;
  }

  private guessNameOf(sp: PokemonSpecies): string {
    for (const lang of this.guessLangIds) {
      const n = sp.pokemonspeciesnames?.find(x => x.language_id === lang)?.name;
      if (n) return n;
    }
    return this.spName(sp);
  }

  private recount(): void {
    this.groupCounts = new Map(this.groups.map(g => [g.id, g.slots.reduce((n, s) => n + (this.guessedIds.has(s.speciesId) ? 1 : 0), 0)]));
  }

  guessedInGroup(g: QuizGroup): number {
    return this.groupCounts.get(g.id) ?? 0;
  }

  private setStatus(s: Omit<QuizStatus, 'seq'>): void {
    this.status = { ...s, seq: ++this.statusSeq };
  }

  formatTime(seconds = this.timerSeconds): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  }

  typeColor(name: string): string { return TYPE_COLORS[name] || '#888'; }
  typeIcon(name: string): string  { return `/images/type-icons/${name}.svg`; }
  typeCap(name: string): string   { return name.charAt(0).toUpperCase() + name.slice(1); }

  // ── Timer / cycle ─────────────────────────────────────────────────────────────

  private startTimer(): void {
    this.timerStarted = true;
    this.timerRef = setInterval(() => {
      this.timerSeconds++;
      if (this.timerSeconds % 10 === 0) this.persist();
      this.cdr.detectChanges();
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timerRef) { clearInterval(this.timerRef); this.timerRef = null; }
  }

  private clearCommit(): void {
    if (this.commitRef) { clearTimeout(this.commitRef); this.commitRef = null; }
  }

  private startCycle(): void {
    this.cycleRef = setInterval(() => { this.cycleIndex++; this.cdr.detectChanges(); }, 3000);
  }

  private clearCycle(): void {
    if (this.cycleRef) { clearInterval(this.cycleRef); this.cycleRef = null; }
  }
}
