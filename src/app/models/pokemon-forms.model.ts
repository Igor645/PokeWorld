import { Name } from "./species-name.model";
import { PokemonSprites } from "./sprite.model";
import { SpriteWrapper } from "./sprite-wrapper.model";

export interface PokemonForms {
  id: number;
  name: string;
  pokemonformnames: Name[];
  pokemonformsprites: SpriteWrapper<PokemonSprites>[];
}
