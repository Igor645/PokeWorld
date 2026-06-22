import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { Subscription } from 'rxjs';

import { PokemonService } from '../../services/pokemon.service';
import { PokemonUtilsService } from '../../utils/pokemon-utils';
import { SettingsService } from '../../services/settings.service';
import { PokemonSpecies } from '../../models/pokemon-species.model';
import { Pokemon } from '../../models/pokemon.model';

interface QuizSlot {
  speciesId: number;
  species: PokemonSpecies;
  pokemon: Pokemon;
  cycleableForms: Pokemon[];
  sortKey: number;
}

interface QuizGroup {
  id: string;
  label: string;
  slots: QuizSlot[];
}

type QuizPhase = 'select-mode' | 'select-gen' | 'select-type' | 'playing';

const TYPE_COLORS: Record<string, string> = {
  normal: '#B9B9AA', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
  grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
  ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
  rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746',
  steel: '#B7B7CE', fairy: '#D685AD',
};

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIcon],
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizComponent implements OnInit, OnDestroy {
  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement>;

  quizPhase: QuizPhase = 'select-mode';
  isLoading = true;
  groups: QuizGroup[] = [];
  columns: QuizGroup[][] = [];
  guessedIds = new Set<number>();
  recentlyGuessedId: number | null = null;
  lastGuessedUrl = '';
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

  private allGroups: QuizGroup[] = [];
  private nameMap = new Map<string, PokemonSpecies>();
  private timerRef: ReturnType<typeof setInterval> | null = null;
  private cycleRef: ReturnType<typeof setInterval> | null = null;
  private langSub?: Subscription;
  private spriteStyleSub?: Subscription;
  private audioCtx: AudioContext | null = null;

  private readonly REGIONAL_GEN: Record<string, number> = {
    alola: 7, galar: 8, paldea: 9, kitakami: 9,
  };

  private readonly GEN_SORT_DEX: Record<number, number> = {
    1: 2, 2: 7, 3: 15, 4: 6, 5: 9, 6: 0, 7: 21, 8: 27, 9: 31,
  };

  private readonly REGIONAL_SORT_DEX: Record<string, number> = {
    alola: 21, galar: 27, hisui: 30, paldea: 31, kitakami: 32,
  };

  constructor(
    private pokemonService: PokemonService,
    private pokemonUtils: PokemonUtilsService,
    private settings: SettingsService,
    private cdr: ChangeDetectorRef,
  ) {}

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

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadSpecies();
    this.langSub = this.pokemonUtils.watchLanguageChanges().subscribe(() => {
      this.buildNameMap();
      this.cdr.detectChanges();
    });
    this.spriteStyleSub = this.settings.watchSetting<string>('spriteStyle').subscribe(() => {
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.clearTimer();
    this.clearCycle();
    this.langSub?.unsubscribe();
    this.spriteStyleSub?.unsubscribe();
    this.audioCtx?.close();
  }

  // ── Data loading ──────────────────────────────────────────────────────────────

  private loadSpecies(): void {
    this.pokemonService.getAllPokemonSpecies().subscribe(res => {
      const all = res.pokemonspecies;
      this.buildGroups(all);
      this.extractTypes(all);
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
            sortKey: spDex.get(30) ?? sp.id,
          });
        } else {
          const sortKey = genSortDex > 0 ? (spDex.get(genSortDex) ?? sp.id * 100000) : sp.id;
          getGenGroup(genId).slots.push({
            speciesId: sp.id, species: sp, pokemon: c.defaultPokemon,
            cycleableForms: [c.defaultPokemon, ...c.cosmeticForms], sortKey,
          });
        }
      }

      for (const [suffix, forms] of c.regionals) {
        if (suffix === 'hisui') {
          if (!forms.length) continue;
          hisuiGroup.slots.push({
            speciesId: sp.id, species: sp, pokemon: forms[0],
            cycleableForms: forms, sortKey: spDex.get(30) ?? sp.id,
          });
          continue;
        }
        const targetGenId = this.REGIONAL_GEN[suffix];
        if (!targetGenId || !forms.length) continue;
        const targetSortDex = this.GEN_SORT_DEX[targetGenId] ?? 0;
        const regionalDexId = this.REGIONAL_SORT_DEX[suffix];
        const sortKey = regionalDexId === targetSortDex
          ? (spDex.get(regionalDexId) ?? sp.id * 100000)
          : (spDex.get(regionalDexId) ?? sp.id) + 10000;
        getGenGroup(targetGenId).slots.push({
          speciesId: sp.id, species: sp, pokemon: forms[0],
          cycleableForms: forms, sortKey,
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
  changeMode(): void { this.clearTimer(); this.clearCycle(); this.quizPhase = 'select-mode'; this.cdr.detectChanges(); }

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

    this.groups     = filtered;
    this.totalCount = new Set(filtered.flatMap(g => g.slots.map(s => s.speciesId))).size;
    const colCount  = Math.min(4, Math.max(1, filtered.length));
    this.columns    = this.distributeToColumns(colCount);
    this.buildNameMap();

    this.guessedIds      = new Set();
    this.inputValue      = '';
    this.lastGuessedUrl  = '';
    this.timerSeconds    = 0;
    this.timerStarted    = false;
    this.finished        = false;
    this.showSilhouettes = false;
    this.revealed        = false;
    this.recentlyGuessedId = null;
    this.cycleIndex      = 0;
    this.clearTimer();
    this.clearCycle();
    this.quizPhase = 'playing';
    this.cdr.detectChanges();
    setTimeout(() => this.inputEl?.nativeElement.focus(), 0);
  }

  // ── Quiz actions ──────────────────────────────────────────────────────────────

  onInput(): void {
    const key = this.norm(this.inputValue);
    if (!key) return;
    const sp = this.nameMap.get(key);
    if (!sp || this.guessedIds.has(sp.id)) return;

    if (!this.timerStarted) this.startTimer();
    if (!this.cycleRef) this.startCycle();

    this.guessedIds = new Set(this.guessedIds).add(sp.id);
    this.recentlyGuessedId = sp.id;
    this.inputValue = '';
    const dp = sp.pokemons?.find(p => p.is_default);
    if (dp) this.lastGuessedUrl = this.imageUrl(dp);
    this.playCorrectSound();

    if (this.guessedIds.size === this.totalCount) {
      this.finished = true;
      this.clearTimer();
    }

    this.cdr.detectChanges();
    setTimeout(() => {
      this.recentlyGuessedId = null;
      this.cdr.detectChanges();
    }, 700);
  }

  enableSilhouettes(): void { this.showSilhouettes = true; this.cdr.detectChanges(); }

  revealAll(): void {
    this.revealed = true;
    this.clearTimer();
    if (!this.cycleRef) this.startCycle();
    this.cdr.detectChanges();
  }

  reset(): void {
    this.guessedIds      = new Set();
    this.inputValue      = '';
    this.lastGuessedUrl  = '';
    this.timerSeconds    = 0;
    this.timerStarted    = false;
    this.finished        = false;
    this.showSilhouettes = false;
    this.revealed        = false;
    this.recentlyGuessedId = null;
    this.cycleIndex      = 0;
    this.clearTimer();
    this.clearCycle();
    this.cdr.detectChanges();
    setTimeout(() => this.inputEl?.nativeElement.focus(), 0);
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
      return !!(s?.other?.home?.front_default || s?.front_default);
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
      if (pokemonName === base || pokemonName.startsWith(`${base}-`)) return r;
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
    const seen = new Set<number>();
    for (const g of this.groups) {
      for (const s of g.slots) {
        if (seen.has(s.speciesId)) continue;
        seen.add(s.speciesId);
        const sp = s.species;
        const loc = this.pokemonUtils.getLocalizedNameFromEntity(sp, 'pokemonspeciesnames');
        if (loc && loc !== 'Unknown') this.nameMap.set(this.norm(loc), sp);
        if (sp.name) this.nameMap.set(this.norm(sp.name.replace(/-/g, ' ')), sp);
      }
    }
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
    const style = this.settings.getSetting<string>('spriteStyle');
    if (style === 'home')  return sprites?.other?.home?.front_default || sprites?.other?.['official-artwork']?.front_default || '';
    if (style === 'pixel') return sprites?.front_default || '';
    return sprites?.other?.['official-artwork']?.front_default || sprites?.other?.home?.front_default || '';
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

  guessedInGroup(g: QuizGroup): number {
    return g.slots.filter(s => this.guessedIds.has(s.speciesId)).length;
  }

  formatTime(): string {
    const h = Math.floor(this.timerSeconds / 3600);
    const m = Math.floor((this.timerSeconds % 3600) / 60);
    const s = this.timerSeconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  }

  typeColor(name: string): string { return TYPE_COLORS[name] || '#888'; }
  typeIcon(name: string): string  { return `/images/type-icons/${name}.svg`; }
  typeCap(name: string): string   { return name.charAt(0).toUpperCase() + name.slice(1); }

  // ── Timer / cycle ─────────────────────────────────────────────────────────────

  private startTimer(): void {
    this.timerStarted = true;
    this.timerRef = setInterval(() => { this.timerSeconds++; this.cdr.detectChanges(); }, 1000);
  }

  private clearTimer(): void {
    if (this.timerRef) { clearInterval(this.timerRef); this.timerRef = null; }
  }

  private startCycle(): void {
    this.cycleRef = setInterval(() => { this.cycleIndex++; this.cdr.detectChanges(); }, 3000);
  }

  private clearCycle(): void {
    if (this.cycleRef) { clearInterval(this.cycleRef); this.cycleRef = null; }
  }

  private playCorrectSound(): void {
    try {
      if (!this.audioCtx) this.audioCtx = new AudioContext();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      const ctx = this.audioCtx;
      const t = ctx.currentTime;
      const env = ctx.createGain();
      env.connect(ctx.destination);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.07, t + 0.004);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      const fund = ctx.createOscillator();
      fund.type = 'triangle';
      fund.frequency.setValueAtTime(659.25, t);
      fund.connect(env);
      fund.start(t);
      fund.stop(t + 0.21);
      const harm = ctx.createOscillator();
      const hg = ctx.createGain();
      harm.type = 'sine';
      harm.frequency.setValueAtTime(1318.5, t);
      hg.gain.setValueAtTime(0.18, t);
      harm.connect(hg);
      hg.connect(env);
      harm.start(t);
      harm.stop(t + 0.21);
    } catch { /* AudioContext unavailable */ }
  }
}
