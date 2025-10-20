import { PokemonType, PokemonTypeWrapper } from './pokemon-type.model';

import { Item } from './item.model';
import { PokemonAbilityWrapper } from './pokemon-ability.model';
import { PokemonColor } from './pokemon-color.model';
import { PokemonCryWrapper } from './pokemon-cry.model';
import { PokemonForms } from './pokemon-forms.model';
import { PokemonItem } from './pokemon-item.model';
import { PokemonShape } from './pokemon-shape.model';
import { PokemonSprites } from './sprite.model';
import { PokemonStat } from './stat.model';
import { SpriteWrapper } from './sprite-wrapper.model';

export interface Pokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  is_default: boolean;
  base_experience: number;
  pokemonsprites: SpriteWrapper<PokemonSprites>[];
  pokemoncries: PokemonCryWrapper[];
  pokemonstats: PokemonStat[];
  pokemonforms: PokemonForms[];
  pokemontypes: PokemonTypeWrapper[];
  pokemonabilities: PokemonAbilityWrapper[];
  pokemonitems: PokemonItem[];
}
