export interface Sprite {
  front_default?: string;
  front_shiny?: string;
  front_female?: string;
  front_shiny_female?: string;
  back_default?: string;
  back_shiny?: string;
  back_female?: string;
  back_shiny_female?: string;
}

export interface OtherSprites {
  ['official-artwork']: Sprite;
  dream_world: Sprite;
  home: Sprite;
}

export interface PokemonSprites extends Sprite {
  other: OtherSprites;
}

