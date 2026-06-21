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

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizComponent implements OnInit, OnDestroy {
  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement>;

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

  private nameMap = new Map<string, PokemonSpecies>();
  private timerRef: ReturnType<typeof setInterval> | null = null;
  private cycleRef: ReturnType<typeof setInterval> | null = null;
  private langSub?: Subscription;
  private spriteStyleSub?: Subscription;
  private audioCtx: AudioContext | null = null;

  // Maps regional form suffix → generation ID of the card where that form belongs.
  // 'hisui' is intentionally absent — Hisuian forms go to the dedicated Hisui group.
  private readonly REGIONAL_GEN: Record<string, number> = {
    alola: 7, galar: 8, paldea: 9, kitakami: 9,
  };

  // Canonical regional pokédex ID used for SORT ORDER within each generation's card.
  // 0 = no single combined dex → fall back to national dex (sp.id).
  // These dexes start at #001 with the region's starter, giving the correct regional order.
  private readonly GEN_SORT_DEX: Record<number, number> = {
    1: 2,   // kanto (= national dex for Gen I)
    2: 7,   // updated-johto  → Chikorita #001
    3: 15,  // updated-hoenn  → Treecko  #001
    4: 6,   // extended-sinnoh → Turtwig  #001 (includes Giratina/Arceus etc.)
    5: 9,   // updated-unova  → Snivy    #001
    6: 0,   // kalos — no combined dex → national dex order
    7: 21,  // updated-alola  → Rowlet   #001
    8: 27,  // galar           → Grookey  #001
    9: 31,  // paldea          → Sprigatito #001
  };

  // Sort dex for REGIONAL FORM slots — the form's own region's dex, for interleaving.
  // When this matches the target group's GEN_SORT_DEX they interleave with native mons.
  // When it differs (Hisuian forms in Gen VIII card which uses Galar dex), add a large
  // offset so they appear after all native + same-region entries.
  private readonly REGIONAL_SORT_DEX: Record<string, number> = {
    alola: 21, galar: 27, hisui: 30, paldea: 31, kitakami: 32,
  };

  constructor(
    private pokemonService: PokemonService,
    private pokemonUtils: PokemonUtilsService,
    private settings: SettingsService,
    private cdr: ChangeDetectorRef,
  ) {}

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

  private loadSpecies(): void {
    this.pokemonService.getAllPokemonSpecies().subscribe(res => {
      const all = res.pokemonspecies;
      this.buildGroups(all);
      this.buildNameMap();
      this.totalCount = all.length;
      this.isLoading = false;
      this.cdr.detectChanges();
      setTimeout(() => this.inputEl?.nativeElement.focus(), 0);
    });
  }

  private buildGroups(all: PokemonSpecies[]): void {
    // Build per-species dex lookup: speciesId → Map<pokedex_id, pokedex_number>
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

    // Hisui gets its own card between Gen VIII (Galar) and Gen IX (Paldea).
    // Native Hisuian species (Wyrdeer etc.) and Hisuian regional forms both land here,
    // ordered by their position in the Hisui regional dex (pokedex id 30).
    const hisuiGroup: QuizGroup = { id: 'hisui', label: 'Hisui', slots: [] };
    const megaGroup: QuizGroup = { id: 'mega', label: 'Mega Evolutions', slots: [] };
    const gmaxGroup: QuizGroup = { id: 'gmax', label: 'Gigantamax', slots: [] };
    const seenPokemonIds = new Set<number>();

    for (const sp of all) {
      if (!sp.generation) continue;
      const c = this.classifyPokemons(sp, seenPokemonIds);
      const spDex = dexLookup.get(sp.id) ?? new Map<number, number>();
      const genId = sp.generation.id;
      const genSortDex = this.GEN_SORT_DEX[genId] ?? 0;

      if (c.defaultPokemon) {
        // Native Gen VIII species that live in the Hisui dex (Wyrdeer, Kleavor, etc.)
        // belong in the Hisui group rather than the Galar group.
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
        // Hisuian forms go to the dedicated Hisui group, sorted by Hisui dex position.
        if (suffix === 'hisui') {
          if (!forms.length) continue;
          hisuiGroup.slots.push({
            speciesId: sp.id, species: sp, pokemon: forms[0],
            cycleableForms: forms,
            sortKey: spDex.get(30) ?? sp.id,
          });
          continue;
        }
        const targetGenId = this.REGIONAL_GEN[suffix];
        if (!targetGenId || !forms.length) continue;
        const targetSortDex = this.GEN_SORT_DEX[targetGenId] ?? 0;
        const regionalDexId = this.REGIONAL_SORT_DEX[suffix];
        // If the regional form's own dex matches the group's sort dex, interleave normally.
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

    // Insert Hisui group between Gen VIII (Galar) and Gen IX (Paldea).
    const gen8Idx = genGroups.findIndex(g => g.id === 'gen-8');
    this.groups = [
      ...genGroups.slice(0, gen8Idx + 1),
      ...(hisuiGroup.slots.length ? [hisuiGroup] : []),
      ...genGroups.slice(gen8Idx + 1),
      ...(megaGroup.slots.length ? [megaGroup] : []),
      ...(gmaxGroup.slots.length ? [gmaxGroup] : []),
    ];
    this.columns = this.distributeToColumns(4);
  }

  private genLabel(genId: number): string {
    const labels: Record<number, string> = {
      1: 'Kanto', 2: 'Johto', 3: 'Hoenn', 4: 'Sinnoh', 5: 'Unova',
      6: 'Kalos', 7: 'Alola', 8: 'Galar', 9: 'Paldea',
    };
    return labels[genId] ?? `Gen ${genId}`;
  }

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
        // Exact match prevents composite names like "raticate-totem-alola" from being
        // misclassified as a regional variant — must be exactly "speciesname-suffix"
        const suffix = this.cleanRegionalSuffix(n, sp.name);
        if (suffix) {
          if (!result.regionals.has(suffix)) result.regionals.set(suffix, []);
          if (hasSprite(p)) result.regionals.get(suffix)!.push(p);
        } else if (!n.includes('-totem')) {
          // Cycle relevant alternate forms (Rotom, Deoxys, Unown, etc.) — skip totem forms
          if (hasSprite(p)) result.cosmeticForms.push(p);
        }
      }
    }

    return result;
  }

  private cleanRegionalSuffix(pokemonName: string, speciesName: string): string | null {
    for (const r of ['alola', 'galar', 'hisui', 'paldea', 'kitakami']) {
      const base = `${speciesName}-${r}`;
      // Exact match covers single-form regionals (rattata-alola).
      // StartsWith covers multi-form regionals (tauros-paldea-combat, -blaze, -aqua).
      // Does NOT match composite names like raticate-totem-alola since that doesn't
      // equal "raticate-alola" nor start with "raticate-alola-".
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
      // Move to the next column once the current one has reached its share,
      // keeping all groups in generation order so I→II→III read down col 0,
      // IV→V→VI down col 1, etc. instead of the "shortest first" scramble.
      if (colIdx < n - 1 && accumulated >= target) {
        colIdx++;
        accumulated = 0;
      }
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

  enableSilhouettes(): void {
    this.showSilhouettes = true;
    this.cdr.detectChanges();
  }

  revealAll(): void {
    this.revealed = true;
    this.clearTimer();
    if (!this.cycleRef) this.startCycle();
    this.cdr.detectChanges();
  }

  reset(): void {
    this.guessedIds = new Set();
    this.inputValue = '';
    this.lastGuessedUrl = '';
    this.timerSeconds = 0;
    this.timerStarted = false;
    this.finished = false;
    this.showSilhouettes = false;
    this.revealed = false;
    this.recentlyGuessedId = null;
    this.cycleIndex = 0;
    this.clearTimer();
    this.clearCycle();
    this.cdr.detectChanges();
    setTimeout(() => this.inputEl?.nativeElement.focus(), 0);
  }

  // Returns the current cycling form to display (changes every 2s once guessing starts).
  // Offset by speciesId so slots are on different phases — not all switching simultaneously.
  currentCycleForm(slot: QuizSlot): Pokemon {
    if (slot.cycleableForms.length <= 1) return slot.pokemon;
    return slot.cycleableForms[(this.cycleIndex + slot.speciesId) % slot.cycleableForms.length];
  }

  imageUrl(pokemon: Pokemon): string {
    const sprites = pokemon.pokemonsprites?.[0]?.sprites;
    const style = this.settings.getSetting<string>('spriteStyle');
    if (style === 'home')   return sprites?.other?.home?.front_default || sprites?.other?.['official-artwork']?.front_default || '';
    if (style === 'pixel')  return sprites?.front_default || '';
    return sprites?.other?.['official-artwork']?.front_default || sprites?.other?.home?.front_default || '';
  }

  groupLabel(g: QuizGroup): string {
    return g.label;
  }

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

  private startTimer(): void {
    this.timerStarted = true;
    this.timerRef = setInterval(() => {
      this.timerSeconds++;
      this.cdr.detectChanges();
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timerRef) { clearInterval(this.timerRef); this.timerRef = null; }
  }

  private startCycle(): void {
    this.cycleRef = setInterval(() => {
      this.cycleIndex++;
      this.cdr.detectChanges();
    }, 3000);
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

      // Soft E5 "ding" — triangle wave (warm) + quiet sine overtone (shimmer).
      // 4 ms attack avoids click; 200 ms exponential decay feels like a small bell.
      const env = ctx.createGain();
      env.connect(ctx.destination);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.07, t + 0.004);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

      const fund = ctx.createOscillator();
      fund.type = 'triangle';
      fund.frequency.setValueAtTime(659.25, t); // E5
      fund.connect(env);
      fund.start(t);
      fund.stop(t + 0.21);

      const harm = ctx.createOscillator();
      const hg = ctx.createGain();
      harm.type = 'sine';
      harm.frequency.setValueAtTime(1318.5, t); // E6 overtone
      hg.gain.setValueAtTime(0.18, t);
      harm.connect(hg);
      hg.connect(env);
      harm.start(t);
      harm.stop(t + 0.21);
    } catch { /* AudioContext unavailable */ }
  }
}
