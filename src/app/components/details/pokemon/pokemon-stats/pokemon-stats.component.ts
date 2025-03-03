import { Component, Input } from '@angular/core';
import { Pokemon } from '../../../../models/pokemon.model';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pokemon-stats',
  templateUrl: './pokemon-stats.component.html',
  styleUrls: ['./pokemon-stats.component.css'],
  imports: [CommonModule]
})
export class PokemonStatsComponent {
  @Input() pokemon!: Pokemon | undefined;
  private readonly MAX_EV = 63; // Maximum EV contribution
  private readonly MAX_IV = 31; // Maximum IV contribution
  private readonly NEGATIVE_NATURE = 0.9; // -10%
  private readonly POSITIVE_NATURE = 1.1; // +10%

  constructor(private pokemonUtils: PokemonUtilsService) {}

  getStats() {
    if (!this.pokemon?.pokemon_v2_pokemonstats) return [];
    
    return this.pokemon.pokemon_v2_pokemonstats.map(stat => {
      const base = stat.base_stat;
      const isHp = stat.pokemon_v2_stat.name.toLowerCase() === 'hp';

      return {
        name: this.pokemonUtils.getNameByLanguage(stat.pokemon_v2_stat.pokemon_v2_statnames),
        value: base,
        min: this.calculateMinStat(base, isHp),
        max: this.calculateMaxStat(base, isHp)
      };
    });
  }

  getStatTotal() {
    if (!this.pokemon?.pokemon_v2_pokemonstats) return 0;
    return this.pokemon.pokemon_v2_pokemonstats.reduce((sum, stat) => sum + stat.base_stat, 0);
  }

  private calculateMinStat(baseStat: number, isHp: boolean): number {
    if (isHp) {
      return Math.floor((2 * baseStat) + 110);
    } else {
      return Math.floor((2 * baseStat + 5) * this.NEGATIVE_NATURE);
    }
  }

  private calculateMaxStat(baseStat: number, isHp: boolean): number {
    if (isHp) {
      return Math.floor((2 * baseStat) + 110 + this.MAX_EV + this.MAX_IV);
    } else {
      return Math.floor((2 * baseStat + 5 + this.MAX_EV + this.MAX_IV) * this.POSITIVE_NATURE);
    }
  }
}
