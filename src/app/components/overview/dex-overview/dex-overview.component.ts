import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject,
  OnDestroy, OnInit, PLATFORM_ID
} from '@angular/core';
import { NgStyle, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MatIcon } from '@angular/material/icon';

import { PokemonSpecies } from '../../../models/pokemon-species.model';
import { Pokemon } from '../../../models/pokemon.model';
import { Generation } from '../../../models/generation.model';
import { PokemonService } from '../../../services/pokemon.service';
import { TypeService } from '../../../services/type.service';
import { RecentlyViewedService, RecentEntry } from '../../../services/recently-viewed.service';
import { PokemonUtilsService } from '../../../utils/pokemon-utils';
import { SettingsService } from '../../../services/settings.service';
import { PokeworldSearchComponent } from '../../search/pokeworld-search/pokeworld-search.component';
import { PokemonCardComponent } from '../../shared/pokemon-card/pokemon-card.component';
import { PokemonDexComponent } from '../../shared/pokemon-dex/pokemon-dex.component';
import { TabBarComponent } from '../../shared/tab-bar/tab-bar.component';
import { Type } from '../../../models/type.model';

interface DisplayEntry { species: PokemonSpecies; pokemon: Pokemon; }

interface SilhouetteConfig {
  species: PokemonSpecies;
  styles: { [key: string]: string };
}

interface GenTileConfig {
  id: number;
  roman: string;
  region: string;
  accentColor: string;
  legendaryId: number;
  games: string[];
  count: number;
  spriteUrl: string;
}

const GAME_COLORS: Record<string, string> = {
  'Red': '#CC0000', 'Blue': '#003088', 'Yellow': '#D4A800',
  'Gold': '#B8860B', 'Silver': '#9090A0', 'Crystal': '#3BAAD4',
  'Ruby': '#B30000', 'Sapphire': '#0000CD', 'Emerald': '#006400',
  'FireRed': '#E84000', 'LeafGreen': '#2E8B22',
  'Diamond': '#6677CC', 'Pearl': '#CC77AA', 'Platinum': '#707080',
  'HeartGold': '#B8860B', 'SoulSilver': '#909099',
  'Black': '#2C2C3C', 'White': '#888899', 'Black 2': '#2C4488', 'White 2': '#4488AA',
  'X': '#025DA6', 'Y': '#E3000B', 'Omega Ruby': '#B30000', 'Alpha Sapphire': '#0000CC',
  'Sun': '#E07000', 'Moon': '#4030AA', 'Ultra Sun': '#CC4000', 'Ultra Moon': '#4420CC',
  "Let's Go Pikachu": '#D4A800', "Let's Go Eevee": '#A06432',
  'Sword': '#0077BB', 'Shield': '#CC2255', 'Legends: Arceus': '#8A6200',
  'Brilliant Diamond': '#6677CC', 'Shining Pearl': '#CC77AA',
  'Scarlet': '#CC2200', 'Violet': '#5500AA',
};

const GENERATION_INFO: Array<Omit<GenTileConfig, 'count' | 'spriteUrl'>> = [
  { id: 1, roman: 'I',    region: 'Kanto',  accentColor: '#CC3344', legendaryId: 150, games: ['Red', 'Blue', 'Yellow'] },
  { id: 2, roman: 'II',   region: 'Johto',  accentColor: '#B8860B', legendaryId: 249, games: ['Gold', 'Silver', 'Crystal'] },
  { id: 3, roman: 'III',  region: 'Hoenn',  accentColor: '#CC0044', legendaryId: 384, games: ['Ruby', 'Sapphire', 'Emerald', 'FireRed', 'LeafGreen'] },
  { id: 4, roman: 'IV',   region: 'Sinnoh', accentColor: '#4488CC', legendaryId: 487, games: ['Diamond', 'Pearl', 'Platinum', 'HeartGold', 'SoulSilver'] },
  { id: 5, roman: 'V',    region: 'Unova',  accentColor: '#555577', legendaryId: 643, games: ['Black', 'White', 'Black 2', 'White 2'] },
  { id: 6, roman: 'VI',   region: 'Kalos',  accentColor: '#0055AA', legendaryId: 716, games: ['X', 'Y', 'Omega Ruby', 'Alpha Sapphire'] },
  { id: 7, roman: 'VII',  region: 'Alola',  accentColor: '#E07800', legendaryId: 791, games: ['Sun', 'Moon', 'Ultra Sun', 'Ultra Moon', "Let's Go Pikachu", "Let's Go Eevee"] },
  { id: 8, roman: 'VIII', region: 'Galar',  accentColor: '#0088FF', legendaryId: 888, games: ['Sword', 'Shield', 'Brilliant Diamond', 'Shining Pearl', 'Legends: Arceus'] },
  { id: 9, roman: 'IX',   region: 'Paldea', accentColor: '#CC2200', legendaryId: 1007, games: ['Scarlet', 'Violet'] },
];

@Component({
  selector: 'app-dex-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgStyle,
    RouterLink,
    MatIcon,
    PokeworldSearchComponent,
    PokemonCardComponent,
    PokemonDexComponent,
    TabBarComponent,
  ],
  templateUrl: './dex-overview.component.html',
  styleUrls: ['./dex-overview.component.css'],
})
export class DexOverviewComponent implements OnInit, OnDestroy {

  // ── Showcase data ──────────────────────────────────────────────────────────
  count = 0;
  allTypes: Type[] = [];
  availableGenerations: Generation[] = [];
  bgSilhouettes: SilhouetteConfig[] = [];
  marqueeRow1: PokemonSpecies[] = [];
  marqueeRow2: PokemonSpecies[] = [];
  genTiles: GenTileConfig[] = [];
  recentSpeciesData: DisplayEntry[] = [];

  /** Two-way bound with app-pokemon-dex — gen tiles click sets this. */
  selectedGen: number | null = null;
  dexMode: 'pokemon' | 'item' = 'pokemon';

  readonly dexTabs = [
    { id: 'pokemon', label: 'Pokémon', icon: 'catching_pokemon' },
    { id: 'item',    label: 'Items',   icon: 'inventory_2' },
  ];

  private allSpecies: PokemonSpecies[] = [];
  private recentlyViewed: RecentEntry[] = [];
  private langSub?: Subscription;
  private spriteStyleSub?: Subscription;
  private versionNameMap = new Map<string, string>();
  private cachedVersionData: Array<{ versionnames: Array<{ name: string; language_id: number }> }> = [];

  constructor(
    private pokemonService: PokemonService,
    private typeService: TypeService,
    private recentlyViewedService: RecentlyViewedService,
    public pokemonUtils: PokemonUtilsService,
    private settingsService: SettingsService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit(): void {
    this.recentlyViewed = this.recentlyViewedService.getAll();
    this.fetchShowcaseData();

    this.typeService.getAllTypes().pipe(
      map((res: any) => res.type.filter((t: Type) => t.id >= 1 && t.id <= 18))
    ).subscribe((types: Type[]) => {
      this.allTypes = types;
      this.cdr.detectChanges();
    });

    this.pokemonService.getVersionNames().subscribe(versions => {
      this.cachedVersionData = versions;
      this.buildVersionNameMap();
      this.cdr.detectChanges();
    });

    this.langSub = this.pokemonUtils.watchLanguageChanges().subscribe(() => {
      this.buildVersionNameMap();
      this.cdr.detectChanges();
    });

    this.spriteStyleSub = this.settingsService.watchSetting<string>('spriteStyle').subscribe(() => {
      this.initGenTiles();
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
    this.spriteStyleSub?.unsubscribe();
  }

  // ── Gen tile interaction ───────────────────────────────────────────────────

  onGenTileClick(genId: number): void {
    this.selectedGen = this.selectedGen === genId ? null : genId;
  }

  getGameColor(game: string): string {
    return GAME_COLORS[game] ?? '#666';
  }

  getLocalizedGameName(name: string): string {
    return this.versionNameMap.get(this.normStr(name)) ?? name;
  }

  trackRecentById(_: number, entry: DisplayEntry): number {
    return entry.species.id;
  }

  // ── Sprites ────────────────────────────────────────────────────────────────

  getSprite(species: PokemonSpecies): string {
    const sprites = species.pokemons[0]?.pokemonsprites?.[0]?.sprites;
    const style = this.settingsService.getSetting<string>('spriteStyle');
    if (style === 'home')  return sprites?.other?.['home']?.front_default || sprites?.other?.['official-artwork']?.front_default || '';
    if (style === 'pixel') return sprites?.front_default || '';
    return sprites?.other?.['official-artwork']?.front_default || sprites?.other?.['home']?.front_default || '';
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private fetchShowcaseData(): void {
    this.pokemonService.getAllPokemonSpecies().pipe(
      catchError(() => of({ pokemonspecies: [], pokemonspecies_aggregate: { aggregate: { count: 0 } } })),
    ).subscribe(response => {
      this.allSpecies = response.pokemonspecies;
      this.count = response.pokemonspecies_aggregate.aggregate.count;

      const genMap = new Map<number, Generation>();
      for (const s of this.allSpecies) {
        if (s.generation && !genMap.has(s.generation.id)) genMap.set(s.generation.id, s.generation);
      }
      this.availableGenerations = [...genMap.values()].sort((a, b) => a.id - b.id);

      this.buildRecentSpecies();
      this.initShowcases();
      this.initGenTiles();
      this.cdr.detectChanges();
    });
  }

  private buildRecentSpecies(): void {
    this.recentSpeciesData = this.recentlyViewed
      .map(entry => {
        const species = this.allSpecies.find(s => s.id === entry.id);
        return species ? { species, pokemon: species.pokemons[0] } : null;
      })
      .filter((e): e is DisplayEntry => !!e);
  }

  private initShowcases(): void {
    const withSprites = this.allSpecies.filter(s => {
      const sp = s.pokemons[0]?.pokemonsprites?.[0]?.sprites;
      return !!(sp?.other?.['official-artwork']?.front_default || sp?.other?.['home']?.front_default);
    });

    const day = new Date().getDate() * 17 + new Date().getMonth() * 53;
    const shuffled = [...withSprites].sort((a, b) => ((a.id * 1327 + day) % 997) - ((b.id * 1327 + day) % 997));

    this.bgSilhouettes = shuffled.slice(0, 16).map((species, i) => ({
      species,
      styles: {
        top: (5 + (i * 13 + 7) % 82) + '%',
        animationDuration: (16 + (i * 2.3) % 16) + 's',
        animationDelay: (-(i * 2.1) % 18) + 's',
        opacity: String(0.07 + (i % 4) * 0.035),
        width: (60 + (i % 4) * 18) + 'px',
        height: (60 + (i % 4) * 18) + 'px',
      },
    }));

    const viewportW = isPlatformBrowser(this.platformId) ? window.innerWidth : 1920;
    const perRow = Math.max(40, Math.ceil(viewportW / 92) + 10);
    this.marqueeRow1 = shuffled.slice(16, 16 + perRow);
    this.marqueeRow2 = shuffled.slice(16 + perRow, 16 + perRow * 2);
  }

  private initGenTiles(): void {
    const countByGen = new Map<number, number>();
    for (const s of this.allSpecies) {
      if (s.generation?.id) countByGen.set(s.generation.id, (countByGen.get(s.generation.id) ?? 0) + 1);
    }
    const style = this.settingsService.getSetting<string>('spriteStyle');
    this.genTiles = GENERATION_INFO
      .filter(info => countByGen.has(info.id))
      .map(info => {
        const sp = this.allSpecies.find(s => s.id === info.legendaryId);
        const sprites = sp?.pokemons?.[0]?.pokemonsprites?.[0]?.sprites;
        const spriteUrl = style === 'home'
          ? (sprites?.other?.['home']?.front_default || sprites?.other?.['official-artwork']?.front_default || '')
          : style === 'pixel'
            ? (sprites?.front_default || '')
            : (sprites?.other?.['official-artwork']?.front_default || sprites?.other?.['home']?.front_default || '');
        return { ...info, count: countByGen.get(info.id) ?? 0, spriteUrl };
      });
  }

  private buildVersionNameMap(): void {
    const langId = this.pokemonUtils.getSelectedLanguageId();
    this.versionNameMap.clear();
    for (const v of this.cachedVersionData) {
      const enName = v.versionnames?.find(n => n.language_id === 9)?.name;
      const locName = v.versionnames?.find(n => n.language_id === langId)?.name;
      if (enName && locName) this.versionNameMap.set(this.normStr(enName), locName);
    }
  }

  private normStr(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
}
