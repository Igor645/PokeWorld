import { Component, Input, OnDestroy, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { PokemonUtilsService } from '../../../utils/pokemon-utils';
import { SettingsService } from '../../../services/settings.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-pokemon-type',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pokemon-type.component.html',
  styleUrls: ['./pokemon-type.component.css']
})
export class PokemonTypeComponent implements OnInit, OnDestroy {
  @Input() pokemonType: any;
  @Input() simpleView: boolean = false;

  isDarkMode: boolean = false;
  localizedTypeName: string = 'Unknown';
  private darkModeSubscription!: Subscription;
  private languageSubscription!: Subscription;

  constructor(
    public pokemonUtils: PokemonUtilsService,
    private settingsService: SettingsService
  ) { }

  typeColorsLight: { [key: string]: string } = {
    normal: '#B9B9AA',
    fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
    grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28',
    poison: '#A33EA1', ground: '#E2BF65', flying: '#A98FF3',
    psychic: '#F95587', bug: '#A6B91A', rock: '#B6A136',
    ghost: '#735797', dragon: '#6F35FC', dark: '#705746',
    steel: '#B7B7CE', fairy: '#D685AD'
  };

  typeColorsDark: { [key: string]: string } = {
    normal: '#8B8B77',
    fire: '#B22222', water: '#1E4D9B', electric: '#C9A917',
    grass: '#507D2A', ice: '#5E9EA0', fighting: '#7D1F1A',
    poison: '#682A68', ground: '#9C773C', flying: '#7A6DAF',
    psychic: '#A13959', bug: '#6D7815', rock: '#786824',
    ghost: '#493963', dragon: '#4C1D95', dark: '#3D2D22',
    steel: '#787887', fairy: '#9B6470'
  };

  ngOnInit() {
    this.darkModeSubscription = this.settingsService.watchSetting<boolean>('darkMode')
      .subscribe(isDark => {
        this.isDarkMode = isDark ?? false;
      });

    this.languageSubscription = this.pokemonUtils.watchLanguageChanges()
      .subscribe(() => {
        this.updateLocalizedTypeName();
      });

    this.updateLocalizedTypeName();
  }

  ngOnDestroy() {
    if (this.darkModeSubscription) {
      this.darkModeSubscription.unsubscribe();
    }
    if (this.languageSubscription) {
      this.languageSubscription.unsubscribe();
    }
  }

  updateLocalizedTypeName() {
    if (this.pokemonType && this.pokemonType.pokemon_v2_typenames) {
      this.localizedTypeName = this.pokemonUtils.getNameByLanguage(this.pokemonType.pokemon_v2_typenames);
    } else {
      this.localizedTypeName = 'Unknown';
    }
  }

  getTypeColor(): string {
    return this.isDarkMode
      ? this.typeColorsDark[this.pokemonType?.name?.toLowerCase()] || '#444'
      : this.typeColorsLight[this.pokemonType?.name?.toLowerCase()] || '#777';
  }

  getTypeIcon(): string {
    return `/images/type-icons/${this.pokemonType?.name?.toLowerCase()}.svg`;
  }
}
