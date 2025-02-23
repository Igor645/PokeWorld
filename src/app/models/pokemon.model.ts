import { PokemonAbilityWrapper } from './pokemon-ability.model';
import { PokemonForms } from './pokemon-forms.model';
import { PokemonType, PokemonTypeWrapper } from './pokemon-type.model';
import { PokemonSpritesWrapper } from './sprite.model';
import { PokemonStat } from './stat.model';

export interface Pokemon {
  id: number;
  name: string;
  is_default: boolean;
  pokemon_v2_pokemonsprites: PokemonSpritesWrapper[];
  pokemon_v2_pokemonstats: PokemonStat[];
  pokemon_v2_pokemonforms: PokemonForms[];
  pokemon_v2_pokemontypes: PokemonTypeWrapper[];
  pokemon_v2_pokemonabilities: PokemonAbilityWrapper[];
}
