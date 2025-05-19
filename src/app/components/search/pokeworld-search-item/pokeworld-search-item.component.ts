import { Component, EventEmitter, Input, Output } from '@angular/core';

import { CommonModule } from '@angular/common';
import { Name } from '../../../models/species-name.model';
import { PokemonBgSvgComponent } from '../../shared/pokemon-bg-svg/pokemon-bg-svg.component';
import { PokemonUtilsService } from '../../../utils/pokemon-utils';
import { Router } from '@angular/router';

@Component({
  selector: 'app-pokemon-search-item',
  templateUrl: './pokeworld-search-item.component.html',
  styleUrls: ['./pokeworld-search-item.component.css'],
  imports: [CommonModule, PokemonBgSvgComponent]
})
export class PokeworldSearchItemComponent {
  @Input() names!: Name[];
  @Input() imageSrc!: string | undefined;
  @Input() endpoint!: string;
  @Input() isSelectable: boolean = true;
  @Output() itemSelected = new EventEmitter<void>();

  constructor(private router: Router, private pokemonUtils: PokemonUtilsService) { }

  getName(): string {
    return this.pokemonUtils.getNameByLanguage(this.names);
  }
}
