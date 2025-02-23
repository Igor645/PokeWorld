import { FlavorText } from "./flavor-text.model";
import { Language } from "./language.model";
import { Name } from "./species-name.model";

export interface PokemonAbilityWrapper {
  pokemon_v2_ability: PokemonAbility;
  is_hidden: boolean;
}

export interface PokemonAbility {
    id: number;
    name: string;
    pokemon_v2_abilityflavortexts: FlavorText[];
    pokemon_v2_abilitynames: Name[];  
}