import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  ElementRef, OnDestroy, OnInit, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { Subscription } from 'rxjs';

import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';
import { PokemonTypeComponent } from '../shared/pokemon-type/pokemon-type.component';
import { PokemonService } from '../../services/pokemon.service';
import { PokemonUtilsService } from '../../utils/pokemon-utils';
import { SettingsService } from '../../services/settings.service';
import { PokemonSpecies } from '../../models/pokemon-species.model';
import { Pokemon } from '../../models/pokemon.model';

interface PokeleGuess { displayName: string; correct: boolean; }

const GEN_ROMAN:  Record<number, string> = { 1:'I', 2:'II', 3:'III', 4:'IV', 5:'V', 6:'VI', 7:'VII', 8:'VIII', 9:'IX' };
const GEN_REGION: Record<number, string> = { 1:'Kanto', 2:'Johto', 3:'Hoenn', 4:'Sinnoh', 5:'Unova', 6:'Kalos', 7:'Alola', 8:'Galar', 9:'Paldea' };
const GEN_ACCENT: Record<number, string> = { 1:'#CC0000', 2:'#C8A400', 3:'#7038F8', 4:'#4080FF', 5:'#505050', 6:'#E84040', 7:'#F09030', 8:'#6050DC', 9:'#C02000' };
const COLOR_HEX:  Record<string, string>  = { black:'#1a1a1a', blue:'#4080FF', brown:'#8B5A2B', gray:'#808080', green:'#3cb371', pink:'#FF69B4', purple:'#7038F8', red:'#CC0000', white:'#d8d8d8', yellow:'#F5C400' };

@Component({
  selector: 'app-pokele',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIcon, LoadingSpinnerComponent, PokemonTypeComponent],
  templateUrl: './pokele.component.html',
  styleUrls: ['./pokele.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PokeleComponent implements OnInit, OnDestroy {
  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement>;

  isLoading     = true;
  detailsLoading = false;
  wrongCount    = 0;
  solved        = false;
  guesses: PokeleGuess[] = [];
  inputValue    = '';
  suggestions: PokemonSpecies[] = [];
  showSuggestions = false;
  activeIndex = -1;
  genFilter: number | null = null;

  basicTarget: PokemonSpecies | null = null;
  fullTarget:  PokemonSpecies | null = null;
  evoChain: PokemonSpecies[] = [];
  private evoTotal_ = 1;

  get target(): PokemonSpecies | null { return this.fullTarget ?? this.basicTarget; }
  get targetPokemon(): Pokemon | null {
    const sp = this.target;
    return sp?.pokemons?.find(p => p.is_default) ?? sp?.pokemons?.[0] ?? null;
  }

  // 7 lives, 6 hints — silhouette is the LAST hint (hint 6, after 6 wrong)
  readonly MAX_WRONG = 7;
  readonly availableGenerations = [1,2,3,4,5,6,7,8,9];
  readonly genRomanMap = GEN_ROMAN;
  readonly livesArray = Array.from({ length: 7 }, (_, i) => i);

  // Hint thresholds — each wrong guess unlocks the next hint
  get gameOver():   boolean { return this.wrongCount >= this.MAX_WRONG && !this.solved; }
  get showHint1():  boolean { return this.wrongCount >= 1 || this.solved || this.gameOver; }  // Generation
  get showHint2():  boolean { return this.wrongCount >= 2 || this.solved || this.gameOver; }  // Types
  get showHint3():  boolean { return this.wrongCount >= 3 || this.solved || this.gameOver; }  // Base stats
  get showHint4():  boolean { return this.wrongCount >= 4 || this.solved || this.gameOver; }  // Evo stage
  get showHint5():  boolean { return this.wrongCount >= 5 || this.solved || this.gameOver; }  // Color + status
  get showHint6():  boolean { return this.wrongCount >= 6 || this.solved || this.gameOver; }  // Silhouette reveal
  get active():     boolean { return !this.solved && !this.gameOver; }

  private allSpecies: PokemonSpecies[] = [];
  private nameMap = new Map<string, PokemonSpecies>();
  private spriteStyleSub?: Subscription;
  private langSub?: Subscription;

  constructor(
    private pokemonService: PokemonService,
    private pokemonUtils: PokemonUtilsService,
    private settings: SettingsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.spriteStyleSub = this.settings.watchSetting<string>('spriteStyle').subscribe(() => this.cdr.markForCheck());
    this.langSub = this.pokemonUtils.watchLanguageChanges().subscribe(() => { this.buildNameMap(); this.cdr.markForCheck(); });
  }

  ngOnDestroy(): void {
    this.spriteStyleSub?.unsubscribe();
    this.langSub?.unsubscribe();
  }

  private loadData(): void {
    this.pokemonService.getAllPokemonSpecies().subscribe(res => {
      this.allSpecies = res.pokemonspecies;
      this.buildNameMap();
      this.isLoading = false;
      this.startNewRound();
    });
  }

  private buildNameMap(): void {
    this.nameMap.clear();
    for (const sp of this.allSpecies) {
      const loc = this.pokemonUtils.getLocalizedNameFromEntity(sp, 'pokemonspeciesnames');
      if (loc && loc !== 'Unknown') this.nameMap.set(this.norm(loc), sp);
      if (sp.name) this.nameMap.set(this.norm(sp.name.replace(/-/g, ' ')), sp);
    }
  }

  private startNewRound(): void {
    const pool = this.genFilter
      ? this.allSpecies.filter(sp => sp.generation?.id === this.genFilter)
      : this.allSpecies;
    if (!pool.length) return;

    const seed = pool[Math.floor(Math.random() * pool.length)];
    this.basicTarget  = seed;
    this.fullTarget   = null;
    this.evoChain     = [];
    this.detailsLoading = true;
    this.cdr.markForCheck();

    this.pokemonService.getPokemonDetails(seed.id).subscribe(res => {
      this.fullTarget = res.pokemonspecies[0] ?? null;
      if (this.fullTarget) this.buildEvoChain();
      this.detailsLoading = false;
      this.cdr.markForCheck();
      setTimeout(() => this.inputEl?.nativeElement.focus(), 0);
    });
  }

  newGame(): void {
    this.wrongCount = 0;
    this.solved     = false;
    this.guesses    = [];
    this.inputValue = '';
    this.suggestions = [];
    this.showSuggestions = false;
    this.cdr.markForCheck();
    this.startNewRound();
  }

  private buildEvoChain(): void {
    const all = this.fullTarget?.evolutionchain?.pokemonspecies;
    if (!all?.length) { this.evoChain = []; this.evoTotal_ = 1; return; }
    const target = this.basicTarget;
    if (!target) { this.evoChain = []; this.evoTotal_ = 1; return; }

    const byId = new Map(all.map(s => [s.id, s]));

    // Walk up from target to root to get the direct ancestral path
    const path: PokemonSpecies[] = [];
    let curr: PokemonSpecies | undefined = byId.get(target.id);
    while (curr) {
      path.unshift(curr);
      curr = curr.evolves_from_species_id ? byId.get(curr.evolves_from_species_id) : undefined;
    }

    // Total stages = path to target + max depth of descendants below target
    this.evoTotal_ = path.length + this.maxDepthBelow(target.id, byId);
    this.evoChain = path;
  }

  private maxDepthBelow(id: number, byId: Map<number, PokemonSpecies>): number {
    const children = Array.from(byId.values()).filter(s => s.evolves_from_species_id === id);
    if (!children.length) return 0;
    return 1 + Math.max(...children.map(c => this.maxDepthBelow(c.id, byId)));
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
      if (e.key === 'Enter' && this.activeIndex >= 0) {
        e.preventDefault();
        this.selectSuggestion(this.suggestions[this.activeIndex]);
        return;
      }
      if (e.key === 'Tab' && this.activeIndex >= 0) {
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
      const drop = document.querySelector('.suggestions-drop');
      const item = drop?.querySelectorAll('.sug-item')[this.activeIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }

  onBlur(): void { setTimeout(() => { this.showSuggestions = false; this.activeIndex = -1; this.cdr.markForCheck(); }, 150); }

  selectSuggestion(sp: PokemonSpecies): void {
    this.inputValue = this.spName(sp);
    this.showSuggestions = false;
    this.activeIndex = -1;
    this.submitGuess(sp);
  }

  private trySubmit(): void {
    const sp = this.nameMap.get(this.norm(this.inputValue));
    if (sp) this.submitGuess(sp);
  }

  private submitGuess(sp: PokemonSpecies): void {
    if (!this.basicTarget || !this.active) return;
    const correct = sp.id === this.basicTarget.id;
    this.guesses  = [{ displayName: this.spName(sp), correct }, ...this.guesses];
    this.inputValue = '';
    this.suggestions = [];
    this.showSuggestions = false;
    if (correct) this.solved = true;
    else this.wrongCount = Math.min(this.wrongCount + 1, this.MAX_WRONG);
    this.cdr.markForCheck();
  }

  setGenFilter(g: number | null): void { this.genFilter = g; this.newGame(); }

  // ── Display helpers ─────────────────────────────────────────────────────────

  spName(sp: PokemonSpecies): string {
    return this.pokemonUtils.getLocalizedNameFromEntity(sp, 'pokemonspeciesnames');
  }

  targetName():  string { return this.basicTarget ? this.spName(this.basicTarget) : '???'; }
  genRoman():    string { return GEN_ROMAN[this.basicTarget?.generation?.id ?? 0]  ?? '?'; }
  genRegion():   string { return GEN_REGION[this.basicTarget?.generation?.id ?? 0] ?? '???'; }
  genAccent():   string { return GEN_ACCENT[this.basicTarget?.generation?.id ?? 0] ?? 'var(--primary-color)'; }
  colorName():   string {
    const c = this.fullTarget?.pokemoncolor;
    return this.pokemonUtils.getLocalizedNameFromEntity(c as any, 'pokemoncolornames') || c?.name || '?';
  }
  colorHex():    string { return COLOR_HEX[this.fullTarget?.pokemoncolor?.name ?? ''] ?? '#888'; }
  statusLabel(): string {
    const sp = this.basicTarget;
    if (!sp) return '???';
    if (sp.is_mythical)  return 'Mythical';
    if (sp.is_legendary) return 'Legendary';
    if (sp.is_baby)      return 'Baby';
    return 'Regular';
  }


  targetHeight(): string {
    const h = this.targetPokemon?.height;
    if (!h) return '?';
    return `${(h / 10).toFixed(1)} m`;
  }
  targetWeight(): string {
    const w = this.targetPokemon?.weight;
    if (!w) return '?';
    return `${(w / 10).toFixed(1)} kg`;
  }

  types(): any[] { return this.targetPokemon?.pokemontypes?.map(pt => pt.type) ?? []; }

  evoTotal():    number   { return this.evoTotal_; }
  evoPosition(): number   { return this.evoChain.length || 1; }
  evoRange():    number[] { return Array.from({ length: this.evoTotal() }, (_, i) => i); }

  sortedStats() {
    return [...(this.targetPokemon?.pokemonstats ?? [])].sort((a, b) => a.stat.id - b.stat.id);
  }
  bst(): number { return this.targetPokemon?.pokemonstats?.reduce((s, st) => s + st.base_stat, 0) ?? 0; }
  statAbbr(name: string): string {
    const map: Record<string,string> = {
      'hp':'HP', 'attack':'ATK', 'defense':'DEF',
      'special-attack':'SP.A', 'special-defense':'SP.D', 'speed':'SPD',
    };
    return map[name] ?? name.slice(0,3).toUpperCase();
  }

  isTarget(sp: PokemonSpecies): boolean { return sp.id === (this.basicTarget?.id ?? -1); }

  targetSpriteUrl(): string {
    const p = this.basicTarget?.pokemons?.find(x => x.is_default) ?? this.basicTarget?.pokemons?.[0];
    return p ? this.spriteFor(p) : '';
  }

  evoSpriteUrl(sp: PokemonSpecies): string {
    const p = sp.pokemons?.find(x => x.is_default) ?? sp.pokemons?.[0];
    return p ? this.spriteFor(p) : '';
  }

  spriteUrl(sp: PokemonSpecies): string {
    const p = sp.pokemons?.find(x => x.is_default) ?? sp.pokemons?.[0];
    return p ? this.spriteFor(p) : '';
  }

  private spriteFor(p: Pokemon): string {
    const s = p.pokemonsprites?.[0]?.sprites;
    const style = this.settings.getSetting<string>('spriteStyle');
    if (style === 'pixel') return s?.front_default || '';
    if (style === 'home')  return s?.other?.home?.front_default || s?.other?.['official-artwork']?.front_default || '';
    return s?.other?.['official-artwork']?.front_default || s?.other?.home?.front_default || '';
  }

  private norm(s: string): string {
    return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  }
}
