import { FlavorText } from "./flavor-text.model";
import { Language } from "./language.model";
import { Name } from "./species-name.model";

export interface PokemonAbilityWrapper {
  ability: PokemonAbility;
  is_hidden: boolean;
}

export interface PokemonAbility {
  id: number;
  name: string;
  abilityflavortexts: FlavorText[];
  abilitynames: Name[];
}
