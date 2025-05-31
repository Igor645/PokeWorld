import { Component, Input, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { ExpandableSectionComponent } from '../../../shared/expandable-section/expandable-section.component';
import { FormsModule } from '@angular/forms';
import { PokemonBgSvgComponent } from '../../../shared/pokemon-bg-svg/pokemon-bg-svg.component';
import { PokemonForms } from '../../../../models/pokemon-forms.model';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';

@Component({
  selector: 'app-pokemon-forms',
  standalone: true,
  imports: [CommonModule, FormsModule, ExpandableSectionComponent, PokemonBgSvgComponent],
  templateUrl: './pokemon-forms.component.html',
  styleUrls: ['./pokemon-forms.component.css']
})
export class PokemonFormsComponent implements OnInit {
  @Input() forms?: PokemonForms[] = [];

  selectedFormId: number | null = null;

  constructor(public pokemonUtils: PokemonUtilsService) { }

  ngOnInit(): void {
    console.log(999, 'PokemonFormsComponent initialized with forms:', this.forms);
    this.selectedFormId = this.forms?.[0]?.id ?? null;
  }

  get selectedForm(): PokemonForms | undefined {
    return this.forms?.find(form => form.id === this.selectedFormId);
  }

  get spriteUrl(): string {
    const sprite = this.selectedForm?.pokemon_v2_pokemonformsprites?.[0]?.sprites?.front_default;

    return sprite || '/images/placeholder.png';
  }

  getFormName(form: PokemonForms): string {
    return this.pokemonUtils.getLocalizedNameFromEntity(form, 'pokemon_v2_pokemonformnames');
  }

  hasAlternativeForms(): boolean {
    return !!this.forms && this.forms.length > 1;
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = '/images/placeholder.png';
  }
}
