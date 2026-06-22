import { Component, HostBinding, Input, OnChanges, OnDestroy, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { DetailRowComponent } from '../../../shared/detail-row/detail-row.component';
import { DetailTableComponent } from '../../../shared/detail-table/detail-table.component';
import { ExpandableSectionComponent } from '../../../shared/expandable-section/expandable-section.component';
import { HeldItemDisplayComponent } from './held-item-display/held-item-display.component';
import { Pokemon } from '../../../../models/pokemon.model';
import { PokemonSpecies } from '../../../../models/pokemon-species.model';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { Subscription } from 'rxjs';
import { VersionStateService } from '../../../../services/version-state.service';

@Component({
  selector: 'app-pokemon-training',
  standalone: true,
  imports: [CommonModule, ExpandableSectionComponent, HeldItemDisplayComponent, DetailTableComponent, DetailRowComponent],
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
    defaultIcon?: string;
  }[] = [];

  private languageSub!: Subscription;
  private versionSub!: Subscription;

  constructor(public utils: PokemonUtilsService, private versionState: VersionStateService) { }

  ngOnInit(): void {
    this.languageSub = this.utils.watchLanguageChanges().subscribe(() => {
      this.groupHeldItems();
    });
    this.versionSub = this.versionState.versionId$.subscribe(() => {
      this.groupHeldItems();
    });
  }

  ngOnChanges(): void {
    this.groupHeldItems();
  }

  ngOnDestroy(): void {
    this.languageSub?.unsubscribe();
    this.versionSub?.unsubscribe();
  }

  groupHeldItems(): void {
    const selectedVersionId = this.versionState.currentVersionId;
    const allItems = this.pokemon?.pokemonitems || [];

    const items = selectedVersionId
      ? allItems.filter(item => item.version?.id === selectedVersionId)
      : allItems;

    const grouped = new Map<string, { name: string; rarity: number; defaultIcon: string }>();

    for (const item of items) {
      const name = this.utils.getLocalizedNameFromEntity(item.item, "itemnames");
      const key = `${name}_${item.rarity}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          name,
          rarity: item.rarity,
          defaultIcon: item.item?.itemsprites[0]?.sprites.default
        });
      }
    }

    this.heldItemsGrouped = Array.from(grouped.values());
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
