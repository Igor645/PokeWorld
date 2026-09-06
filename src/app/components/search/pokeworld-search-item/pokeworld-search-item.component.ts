import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';

import { PokemonBgSvgComponent } from '../../shared/pokemon-bg-svg/pokemon-bg-svg.component';
import { PokemonSpecies } from '../../../models/pokemon-species.model';
import { PokemonUtilsService } from '../../../utils/pokemon-utils';
import { Router } from '@angular/router';

@Component({
  selector: 'app-pokemon-search-item',
  templateUrl: './pokeworld-search-item.component.html',
  styleUrls: ['./pokeworld-search-item.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [PokemonBgSvgComponent]
})
export class PokeworldSearchItemComponent {
  @Input() species?: PokemonSpecies;
  @Input() overrideName?: string;
  @Input() imageSrc!: string | undefined;
  @Input() endpoint!: string;
  @Input() isSelectable: boolean = true;
  @Output() itemSelected = new EventEmitter<void>();

  constructor(private router: Router, private pokemonUtils: PokemonUtilsService) { }

  getName(): string {
    if (this.overrideName) return this.overrideName;
    if (this.species) return this.pokemonUtils.getLocalizedNameFromEntity(this.species, "pokemonspeciesnames");
    return '';
  }
}
