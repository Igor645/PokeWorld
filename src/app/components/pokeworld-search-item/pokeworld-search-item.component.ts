import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Name } from '../../models/species-name.model';
import { Router } from '@angular/router';
import { getNameByLanguage } from '../../utils/pokemon-utils';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pokemon-search-item',
  templateUrl: './pokeworld-search-item.component.html',
  styleUrls: ['./pokeworld-search-item.component.css'],
  imports: [CommonModule]
})
export class PokeworldSearchItemComponent {
  @Input() names!: Name[];
  @Input() imageSrc!: string | undefined;
  @Input() endpoint!: string;
  @Input() isSelectable: boolean = true;
  @Output() itemSelected = new EventEmitter<void>();

  constructor(private router: Router) {}

  getName(): string {
    return getNameByLanguage(this.names, "en");
  }
}
