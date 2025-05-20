import { AfterViewChecked, ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { CommonModule } from '@angular/common';
import { ExpandableSectionComponent } from '../../../shared/expandable-section/expandable-section.component';
import { LanguageService } from '../../../../services/language.service';
import { Pokemon } from '../../../../models/pokemon.model';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-pokemon-stats',
  templateUrl: './pokemon-stats.component.html',
  styleUrls: ['./pokemon-stats.component.css'],
  imports: [CommonModule, ExpandableSectionComponent]
})
export class PokemonStatsComponent {
  private _pokemon: Pokemon | undefined;
  private languageSub: Subscription;
  stats: any[] = [];
  statTotal: number = 0;
  private readonly MAX_EV = 63;
  private readonly MAX_IV = 31;
  private readonly NEGATIVE_NATURE = 0.9;
  private readonly POSITIVE_NATURE = 1.1;

  constructor(
    private pokemonUtils: PokemonUtilsService,
    private languageService: LanguageService
  ) {
    this.languageSub = this.languageService.watchLanguageChanges().subscribe(() => {
      this.computeStats();
    });
  }

  @Input() set pokemon(value: Pokemon | undefined) {
    if (value !== this._pokemon) {
      this._pokemon = value;
      this.computeStats();
    }
  }

  private computeStats() {
    if (!this._pokemon?.pokemon_v2_pokemonstats) {
      this.stats = [];
      this.statTotal = 0;
      return;
    }

    this.stats = this._pokemon.pokemon_v2_pokemonstats.map(stat => {
      const base = stat.base_stat;
      const isHp = stat.pokemon_v2_stat.name.toLowerCase() === 'hp';

      return {
        name: this.pokemonUtils.getNameByLanguage(stat.pokemon_v2_stat.pokemon_v2_statnames),
        value: base,
        min: this.calculateMinStat(base, isHp),
        max: this.calculateMaxStat(base, isHp)
      };
    });

    this.statTotal = this._pokemon.pokemon_v2_pokemonstats.reduce((sum, stat) => sum + stat.base_stat, 0);
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

  trackStat(index: number, stat: any) {
    return stat.name;
  }
}
