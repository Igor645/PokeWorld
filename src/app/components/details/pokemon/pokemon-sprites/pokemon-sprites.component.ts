import { Component, HostBinding, HostListener, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpandableSectionComponent } from '../../../shared/expandable-section/expandable-section.component';
import { Pokemon } from '../../../../models/pokemon.model';
import { PokemonSprites, Sprite } from '../../../../models/sprite.model';

interface SpriteEntry {
  url: string;
  label: string;
  isShiny: boolean;
}

interface SpriteCategory {
  name: string;
  sprites: SpriteEntry[];
  isPixel: boolean;
}

interface SpriteGroup {
  label: string | null;
  categories: SpriteCategory[];
}

interface MatrixRow {
  label: string;
  isShiny: boolean;
  cells: (SpriteEntry | null)[];
}

interface SpriteMatrix {
  groupLabel: string | null;
  columnHeaders: string[];
  columnIsPixel: boolean[];
  rows: MatrixRow[];
  gridCols: string;
}

// ── Field descriptors ────────────────────────────────────────────────────────

const SPRITE_KEYS: Array<{ key: keyof Sprite; label: string; isShiny: boolean }> = [
  { key: 'front_default',      label: 'Front',         isShiny: false },
  { key: 'front_shiny',        label: 'Front Shiny',   isShiny: true  },
  { key: 'back_default',       label: 'Back',          isShiny: false },
  { key: 'back_shiny',         label: 'Back Shiny',    isShiny: true  },
  { key: 'front_female',       label: 'Front ♀',       isShiny: false },
  { key: 'front_shiny_female', label: 'Front Shiny ♀', isShiny: true  },
  { key: 'back_female',        label: 'Back ♀',        isShiny: false },
  { key: 'back_shiny_female',  label: 'Back Shiny ♀',  isShiny: true  },
];

const VERSIONED_FIELDS: Array<{ key: string; label: string; isShiny: boolean }> = [
  { key: 'front_default',      label: 'Front',           isShiny: false },
  { key: 'front_shiny',        label: 'Front Shiny',     isShiny: true  },
  { key: 'back_default',       label: 'Back',            isShiny: false },
  { key: 'back_shiny',         label: 'Back Shiny',      isShiny: true  },
  { key: 'front_female',       label: 'Front ♀',         isShiny: false },
  { key: 'front_shiny_female', label: 'Front Shiny ♀',   isShiny: true  },
  { key: 'back_female',        label: 'Back ♀',          isShiny: false },
  { key: 'back_shiny_female',  label: 'Back Shiny ♀',    isShiny: true  },
  { key: 'front_gray',         label: 'Front (Gray)',     isShiny: false },
  { key: 'back_gray',          label: 'Back (Gray)',      isShiny: false },
];

const ROW_LABEL_ORDER: Array<{ label: string; isShiny: boolean }> = [
  ...SPRITE_KEYS.map(k => ({ label: k.label, isShiny: k.isShiny })),
  { label: 'Front (Gray)', isShiny: false },
  { label: 'Back (Gray)',  isShiny: false },
];

const OTHER_CATEGORY_ORDER = ['official-artwork', 'home', 'dream_world', 'showdown'];
const OTHER_CATEGORY_LABELS: Record<string, string> = {
  'official-artwork': 'Official Artwork',
  'home':             'Pokémon HOME',
  'dream_world':      'Dream World',
  'showdown':         'Showdown',
};

const GENERATION_ORDER = [
  'generation-i', 'generation-ii', 'generation-iii', 'generation-iv',
  'generation-v', 'generation-vi', 'generation-vii', 'generation-viii', 'generation-ix',
];
const GENERATION_LABELS: Record<string, string> = {
  'generation-i':    'Generation I',
  'generation-ii':   'Generation II',
  'generation-iii':  'Generation III',
  'generation-iv':   'Generation IV',
  'generation-v':    'Generation V',
  'generation-vi':   'Generation VI',
  'generation-vii':  'Generation VII',
  'generation-viii': 'Generation VIII',
  'generation-ix':   'Generation IX',
};
const GAME_LABELS: Record<string, string> = {
  'red-blue':                'Red / Blue',
  'yellow':                  'Yellow',
  'crystal':                 'Crystal',
  'gold':                    'Gold',
  'silver':                  'Silver',
  'emerald':                 'Emerald',
  'firered-leafgreen':       'FireRed / LeafGreen',
  'ruby-sapphire':           'Ruby / Sapphire',
  'diamond-pearl':           'Diamond / Pearl',
  'heartgold-soulsilver':    'HeartGold / SoulSilver',
  'platinum':                'Platinum',
  'black-white':             'Black / White',
  'omegaruby-alphasapphire': 'Omega Ruby / Alpha Sapphire',
  'x-y':                     'X / Y',
  'ultra-sun-ultra-moon':    'Ultra Sun / Ultra Moon',
  'icons':                   'Icons',
};

@Component({
  selector: 'app-pokemon-sprites',
  standalone: true,
  imports: [CommonModule, ExpandableSectionComponent],
  templateUrl: './pokemon-sprites.component.html',
  styleUrls: ['./pokemon-sprites.component.css']
})
export class PokemonSpritesComponent implements OnChanges {
  @Input() pokemon?: Pokemon;

  isExpanded = true;
  matrices: SpriteMatrix[] = [];
  expandedGens = new Set<string>();
  lightbox: { url: string; label: string; isPixel: boolean } | null = null;

  @HostListener('document:keydown.escape')
  onEscape() { this.lightbox = null; }

  @HostBinding('class.expanded')
  get hostExpanded() { return this.isExpanded; }

  ngOnChanges(): void {
    const groups = this.buildGroups(this.pokemon?.pokemonsprites?.[0]?.sprites);
    this.matrices = groups.map(g => this.toMatrix(g));
    this.expandedGens.clear();
  }

  openLightbox(url: string, label: string, isPixel: boolean): void {
    this.lightbox = { url, label, isPixel };
  }

  closeLightbox(): void { this.lightbox = null; }

  toggleGen(label: string): void {
    if (this.expandedGens.has(label)) this.expandedGens.delete(label);
    else this.expandedGens.add(label);
  }

  isGenExpanded(label: string): boolean {
    return this.expandedGens.has(label);
  }

  private toMatrix(group: SpriteGroup): SpriteMatrix {
    const cats = group.categories;

    const seen = new Set<string>();
    for (const cat of cats) for (const s of cat.sprites) seen.add(s.label);

    const ordered = ROW_LABEL_ORDER.filter(m => seen.has(m.label));
    const extra = [...seen]
      .filter(l => !ROW_LABEL_ORDER.some(m => m.label === l))
      .map(l => ({ label: l, isShiny: false }));

    const rows: MatrixRow[] = [...ordered, ...extra]
      .map(({ label, isShiny }) => ({
        label,
        isShiny,
        cells: cats.map(cat => cat.sprites.find(s => s.label === label) ?? null),
      }))
      .filter(row => row.cells.some(c => c !== null));

    const n = cats.length;
    const gridCols = `max-content ${Array(n).fill('minmax(0,1fr)').join(' ')}`;

    return {
      groupLabel: group.label,
      columnHeaders: cats.map(c => c.name),
      columnIsPixel: cats.map(c => c.isPixel),
      rows,
      gridCols,
    };
  }

  private buildGroups(raw: PokemonSprites | undefined): SpriteGroup[] {
    if (!raw) return [];
    const groups: SpriteGroup[] = [];

    // ── Modern sprites (current gen, no group label) ─────────────────────────
    const modernCategories: SpriteCategory[] = [];

    const pixelSprites = this.extractSprites(raw);
    if (pixelSprites.length) {
      modernCategories.push({ name: 'Pixel Sprites', isPixel: true, sprites: pixelSprites });
    }

    if (raw.other) {
      const orderedKeys = [
        ...OTHER_CATEGORY_ORDER.filter(k => k in raw.other!),
        ...Object.keys(raw.other).filter(k => !OTHER_CATEGORY_ORDER.includes(k)),
      ];
      for (const key of orderedKeys) {
        const sprites = this.extractSprites(raw.other[key]);
        if (sprites.length) {
          modernCategories.push({
            name: OTHER_CATEGORY_LABELS[key] ?? key,
            isPixel: false,
            sprites,
          });
        }
      }
    }

    if (modernCategories.length) {
      groups.push({ label: null, categories: modernCategories });
    }

    // ── Per-generation sprites ───────────────────────────────────────────────
    if (!raw.versions) return groups;

    for (const genKey of GENERATION_ORDER) {
      const genData = raw.versions[genKey];
      if (!genData) continue;

      const categories: SpriteCategory[] = [];

      for (const [gameKey, gameData] of Object.entries(genData)) {
        if (!gameData || typeof gameData !== 'object') continue;

        const obj = gameData as Record<string, unknown>;
        const sprites = this.extractVersionedSprites(obj);
        if (sprites.length) {
          categories.push({ name: GAME_LABELS[gameKey] ?? gameKey, isPixel: true, sprites });
        }

        // Gen V animated sub-object
        const animated = obj['animated'];
        if (animated && typeof animated === 'object') {
          const animSprites = this.extractVersionedSprites(animated as Record<string, unknown>);
          if (animSprites.length) {
            categories.push({
              name: `${GAME_LABELS[gameKey] ?? gameKey} (Anim.)`,
              isPixel: true,
              sprites: animSprites,
            });
          }
        }
      }

      if (categories.length) {
        groups.push({ label: GENERATION_LABELS[genKey] ?? genKey, categories });
      }
    }

    return groups;
  }

  private extractSprites(sprite: Sprite | undefined): SpriteEntry[] {
    if (!sprite) return [];
    return SPRITE_KEYS
      .filter(k => !!sprite[k.key])
      .map(k => ({ url: sprite[k.key]!, label: k.label, isShiny: k.isShiny }));
  }

  private extractVersionedSprites(obj: Record<string, unknown>): SpriteEntry[] {
    return VERSIONED_FIELDS
      .filter(f => typeof obj[f.key] === 'string' && !!obj[f.key])
      .map(f => ({ url: obj[f.key] as string, label: f.label, isShiny: f.isShiny }));
  }
}
