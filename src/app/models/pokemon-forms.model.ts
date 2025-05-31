import { Name } from "./species-name.model";
import { PokemonSprites } from "./sprite.model";
import { SpriteWrapper } from "./sprite-wrapper.model";

export interface PokemonForms {
  id: number;
  name: string;
  pokemon_v2_pokemonformnames: Name[];
  pokemon_v2_pokemonformsprites: SpriteWrapper<PokemonSprites>[];
}
