import { PokemonAbilityWrapper } from './pokemon-ability.model';
import { PokemonCryWrapper } from './pokemon-cry.model';
import { PokemonForms } from './pokemon-forms.model';
import { PokemonItem } from './pokemon-item.model';
import { PokemonSprites } from './sprite.model';
import { PokemonStat } from './stat.model';
import { PokemonType, PokemonTypePast } from './pokemon-type.model';
import { SpriteWrapper } from './sprite-wrapper.model';

export interface Pokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  is_default: boolean;
  base_experience: number;
  pokemonabilities: PokemonAbilityWrapper[];
  pokemoncries: PokemonCryWrapper[];
  pokemonforms: PokemonForms[];
  pokemonitems: PokemonItem[];
  pokemonsprites: SpriteWrapper<PokemonSprites>[];
  pokemonstats: PokemonStat[];
  pokemontypes: PokemonType[];
  pokemontypepasts?: PokemonTypePast[];
}
