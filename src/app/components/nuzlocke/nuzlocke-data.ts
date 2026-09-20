import { PROGRESSION } from './progression';

export interface Milestone {
  name: string;
  role: 'gym' | 'rival' | 'elite4' | 'champion' | 'boss';
  aceLevel: number;
  acePokemon: string; // PokeAPI slug for sprite
  afterRoute: string; // route name this milestone appears after in the table
  badge?: string;
  type?: string; // primary type for coloring
}

export interface GameData {
  name: string;
  routes: string[];
  milestones: Milestone[];
  locationRegion?: string; // PokeAPI region prefix for numbered routes (e.g. "johto" → "johto-route-29")
}

// PokeAPI language ID → language name used in species names[]
export const LANG_ID_TO_API_NAME: Record<number, string> = {
  1: 'ja',
  2: 'roomaji',
  3: 'ko',
  4: 'zh-Hant',
  5: 'fr',
  6: 'de',
  7: 'es',
  8: 'it',
  9: 'en',
  10: 'cs',
  11: 'ja',
  12: 'zh-Hans',
};

// PokeAPI version name(s) per game key for filtering encounter data
export const GAME_VERSIONS: Record<string, string[]> = {
  'red-blue':           ['red', 'blue'],
  'yellow':             ['yellow'],
  'gold-silver':        ['gold', 'silver'],
  'crystal':            ['crystal'],
  'ruby-sapphire':      ['ruby', 'sapphire'],
  'emerald':            ['emerald'],
  'firered-leafgreen':  ['firered', 'leafgreen'],
  'diamond-pearl':      ['diamond', 'pearl'],
  'platinum':           ['platinum'],
  'heartgold-soulsilver': ['heartgold', 'soulsilver'],
  'black-white':        ['black', 'white'],
  'black2-white2':      ['black-2', 'white-2'],
  'x-y':               ['x', 'y'],
  'oras':              ['omega-ruby', 'alpha-sapphire'],
  'sun-moon':          ['sun', 'moon'],
  'usum':              ['ultra-sun', 'ultra-moon'],
  'sword-shield':       ['sword', 'shield'],
  'scarlet-violet':     ['scarlet', 'violet'],
};

export const GAMES: Record<string, GameData> = {
  'red-blue': {
    name: 'Red / Blue',
    locationRegion: 'kanto',
    routes: [],
    milestones: [],
  },
  'yellow': {
    name: 'Yellow',
    locationRegion: 'kanto',
    routes: [],
    milestones: [],
  },
  'gold-silver': {
    name: 'Gold / Silver',
    locationRegion: 'johto',
    routes: [],
    milestones: [],
  },
  'crystal': {
    name: 'Crystal',
    locationRegion: 'johto',
    routes: [],
    milestones: [],
  },
  'ruby-sapphire': {
    name: 'Ruby / Sapphire',
    locationRegion: 'hoenn',
    routes: [],
    milestones: [],
  },
  'emerald': {
    name: 'Emerald',
    locationRegion: 'hoenn',
    routes: [],
    milestones: [],
  },
  'firered-leafgreen': {
    name: 'FireRed / LeafGreen',
    locationRegion: 'kanto',
    routes: [],
    milestones: [],
  },
  'diamond-pearl': {
    name: 'Diamond / Pearl',
    locationRegion: 'sinnoh',
    routes: [],
    milestones: [],
  },
  'platinum': {
    name: 'Platinum',
    locationRegion: 'sinnoh',
    routes: [],
    milestones: [],
  },
  'heartgold-soulsilver': {
    name: 'HeartGold / SoulSilver',
    locationRegion: 'johto',
    routes: [],
    milestones: [],
  },
  'black-white': {
    name: 'Black / White',
    locationRegion: 'unova',
    routes: [],
    milestones: [],
  },
  'black2-white2': {
    name: 'Black 2 / White 2',
    locationRegion: 'unova',
    routes: [],
    milestones: [],
  },
  'x-y': {
    name: 'X / Y',
    locationRegion: 'kalos',
    routes: [],
    milestones: [],
  },
  'oras': {
    name: 'Omega Ruby / Alpha Sapphire',
    locationRegion: 'hoenn',
    routes: [],
    milestones: [],
  },
  'sun-moon': {
    name: 'Sun / Moon',
    locationRegion: 'alola',
    routes: [],
    milestones: [],
  },
  'usum': {
    name: 'Ultra Sun / Ultra Moon',
    locationRegion: 'alola',
    routes: [],
    milestones: [],
  },
  'sword-shield': {
    name: 'Sword / Shield',
    locationRegion: 'galar',
    routes: [],
    milestones: [],
  },
  'scarlet-violet': {
    name: 'Scarlet / Violet',
    locationRegion: 'paldea',
    routes: [],
    milestones: [],
  },
  'custom': {
    name: 'Custom / Fan Game / ROM Hack',
    routes: [],
    milestones: [],
  },
};

// Route order and boss placement are generated from walkthroughs (scripts/build-progression.py).
for (const [key, p] of Object.entries(PROGRESSION)) {
  const game = GAMES[key];
  if (game) { game.routes = p.routes; game.milestones = p.milestones; }
}
