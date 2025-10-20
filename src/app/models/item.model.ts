import { Name } from './species-name.model';
import { SpriteWrapper } from './sprite-wrapper.model';

export interface Item {
  id: number;
  name: string;
  itemnames: Name[];
  itemsprites: SpriteWrapper<ItemSprite>[];
}

export interface ItemResponse {
  item: Item[];
}

export interface ItemSprite {
  default: string;
}
