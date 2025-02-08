import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Name } from '../../models/species-name.model';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PokemonUtilsService } from '../../utils/pokemon-utils';
import { PokemonBgSvgComponent } from '../pokemon-bg-svg/pokemon-bg-svg.component';

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

  constructor(private router: Router, private pokemonUtils: PokemonUtilsService) {}

  getName(): string {
    return this.pokemonUtils.getNameByLanguage(this.names);
  }
}
