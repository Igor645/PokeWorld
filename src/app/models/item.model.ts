import { SpriteWrapper } from './sprite-wrapper.model';

export interface Item {
  id: number;
  name: string;
  pokemon_v2_itemsprites: SpriteWrapper<ItemSprite>;
}

export interface ItemResponse {
  pokemon_v2_item: Item[];
}

export interface ItemSprite {
  default: string;
}
