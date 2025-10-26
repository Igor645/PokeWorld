import { Component, HostBinding, Input, OnChanges } from '@angular/core';
import { PokemonType, PokemonTypeWrapper } from '../../../../models/pokemon-type.model';

import { CommonModule } from '@angular/common';
import { ExpandableSectionComponent } from '../../../shared/expandable-section/expandable-section.component';
import { PokemonTypeComponent } from '../../../shared/pokemon-type/pokemon-type.component';

type EffectivenessCategory =
  | 'noDamage'
  | 'quarterDamage'
  | 'halfDamage'
  | 'doubleDamage'
  | 'quadrupleDamage';

type EffectivenessMap = Record<EffectivenessCategory, PokemonType[]>;

@Component({
  selector: 'app-pokemon-relations',
  standalone: true,
  imports: [CommonModule, PokemonTypeComponent, ExpandableSectionComponent],
  templateUrl: './pokemon-relations.component.html',
  styleUrls: ['./pokemon-relations.component.css']
})
export class PokemonRelationsComponent implements OnChanges {
  @Input() pokemonTypes: PokemonTypeWrapper[] | undefined = [];
  @Input() allTypes: PokemonType[] = [];

  isExpanded = true;

  @HostBinding('class.expanded')
  get hostExpanded() { return this.isExpanded; }

  relations: EffectivenessMap = {
    noDamage: [],
    quarterDamage: [],
    halfDamage: [],
    doubleDamage: [],
    quadrupleDamage: []
  };

  ngOnChanges(): void {
    this.calculateRelations();
  }

  calculateRelations(): void {
    if (!this.pokemonTypes || this.pokemonTypes.length === 0 || this.allTypes.length === 0) return;

    const defenderTypeIds = this.pokemonTypes.map(t => t.type.id);
    const combined: Record<number, number> = {};

    for (const attackType of this.allTypes) {
      const relevantEfficacies = attackType.typeefficacies.filter(eff =>
        defenderTypeIds.includes(eff.target_type_id)
      );

      if (relevantEfficacies.length === 0) continue;

      const totalMultiplier = relevantEfficacies.reduce((acc, eff) => acc * (eff.damage_factor / 100), 1);

      combined[attackType.id] = totalMultiplier;
    }

    const categorized: EffectivenessMap = {
      noDamage: [],
      quarterDamage: [],
      halfDamage: [],
      doubleDamage: [],
      quadrupleDamage: []
    };

    for (const [idStr, multiplier] of Object.entries(combined)) {
      const id = parseInt(idStr, 10);
      const type = this.getTypeById(id);
      if (!type) continue;

      if (multiplier === 0) categorized.noDamage.push(type);
      else if (multiplier === 0.25) categorized.quarterDamage.push(type);
      else if (multiplier === 0.5) categorized.halfDamage.push(type);
      else if (multiplier === 2) categorized.doubleDamage.push(type);
      else if (multiplier === 4) categorized.quadrupleDamage.push(type);
    }

    this.relations = categorized;
  }

  getTypeById(id: number): PokemonType | undefined {
    return this.allTypes.find(t => t.id === id);
  }

  getRelationKeys(): EffectivenessCategory[] {
    return ['noDamage', 'quarterDamage', 'halfDamage', 'doubleDamage', 'quadrupleDamage'];
  }

  getLabel(key: EffectivenessCategory): string {
    return {
      noDamage: 'No Damage',
      quarterDamage: '¼× Damage',
      halfDamage: '½× Damage',
      doubleDamage: '2× Damage',
      quadrupleDamage: '4× Damage'
    }[key];
  }

  openTypeChart(): void {
    window.open('https://pokemondb.net/type', '_blank');
  }
}
