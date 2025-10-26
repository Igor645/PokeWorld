import { Component, HostBinding, Input, OnChanges, OnDestroy, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { ExpandableSectionComponent } from '../../../shared/expandable-section/expandable-section.component';
import { HeldItemDisplayComponent } from './held-item-display/held-item-display.component';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Pokemon } from '../../../../models/pokemon.model';
import { PokemonSpecies } from '../../../../models/pokemon-species.model';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-pokemon-training',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, ExpandableSectionComponent, HeldItemDisplayComponent],
  templateUrl: './pokemon-training.component.html',
  styleUrls: ['./pokemon-training.component.css']
})
export class PokemonTrainingComponent implements OnInit, OnChanges, OnDestroy {
  @Input() pokemon!: Pokemon | undefined;
  @Input() species!: PokemonSpecies | undefined;

  isExpanded = true;

  @HostBinding('class.expanded')
  get hostExpanded() { return this.isExpanded; }

  heldItemsGrouped: {
    name: string;
    rarity: number;
    count: number;
    tooltip: string;
    defaultIcon?: string;
  }[] = [];

  private languageSub!: Subscription;

  constructor(public utils: PokemonUtilsService) { }

  ngOnInit(): void {
    this.languageSub = this.utils.watchLanguageChanges().subscribe(() => {
      this.groupHeldItems();
    });
  }

  ngOnChanges(): void {
    this.groupHeldItems();
  }

  ngOnDestroy(): void {
    this.languageSub?.unsubscribe();
  }

  groupHeldItems(): void {
    const languageId = this.utils.getSelectedLanguageId();
    const grouped = new Map<string, { name: string; rarity: number; count: number; tooltip: string; defaultIcon: string }>();

    for (const item of this.pokemon?.pokemonitems || []) {
      const name = this.utils.getLocalizedNameFromEntity(item.item, "itemnames");
      const key = `${name}_${item.rarity}`;
      const versionName = item.version?.versionnames?.find(
        vn => vn.language_id === languageId
      )?.name ?? 'Unknown Version';

      if (!grouped.has(key)) {
        grouped.set(key, {
          name,
          rarity: item.rarity,
          count: 1,
          tooltip: `Held in:\n${versionName}`,
          defaultIcon: item.item?.itemsprites[0]?.sprites.default
        });
      } else {
        const existing = grouped.get(key)!;
        existing.count++;
        if (!existing.tooltip.includes(versionName)) {
          existing.tooltip += `, ${versionName}`;
        }
      }
    }

    this.heldItemsGrouped = Array.from(grouped.values()).map(item => ({
      ...item,
      tooltip: `(${item.count}×) Held in:\n` + item.tooltip.split('\n')[1]
    }));
  }

  get evYield(): string {
    const stats = this.pokemon?.pokemonstats || [];
    const relevant = stats.filter(s => s.effort > 0);
    return relevant.map(s =>
      `${s.effort} ${this.utils.getLocalizedNameFromEntity(s.stat, "statnames")}`
    ).join(', ');
  }

  get catchRate(): number {
    return this.species?.capture_rate ?? 0;
  }

  get catchRatePercent(): string {
    const percent = (this.catchRate / 255) * 100;
    return `${percent.toFixed(1)}%`;
  }

  get baseHappiness(): number {
    return this.species?.base_happiness ?? 0;
  }

  get happinessDescription(): string {
    const val = this.baseHappiness;
    if (val <= 35) return 'Very low';
    if (val <= 70) return 'Lower than normal';
    if (val <= 100) return 'Normal';
    return 'High';
  }

  get baseExp(): number {
    return this.pokemon?.base_experience ?? 0;
  }
}
