import {
  Component,
  Input,
  OnDestroy,
  OnInit,
  Optional,
  Self
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { PokemonUtilsService } from '../../../utils/pokemon-utils';
import { SettingsService } from '../../../services/settings.service';
import { Subscription } from 'rxjs';
import { InteractiveHostDirective } from '../directives/interactive-host.directive';

@Component({
  selector: 'app-pokemon-type',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pokemon-type.component.html',
  styleUrls: ['./pokemon-type.component.css'],
  hostDirectives: [InteractiveHostDirective]
})
export class PokemonTypeComponent implements OnInit, OnDestroy {
  @Input() pokemonType: any;
  @Input() simpleView: boolean = false;

  isDarkMode: boolean = false;
  localizedTypeName: string = 'Unknown';
  private darkModeSubscription!: Subscription;
  private languageSubscription!: Subscription;

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
    normal: '#A0A08C',
    fire: '#D75A4A',
    water: '#3A6DB2',
    electric: '#D4B63A',
    grass: '#5E9C5E',
    ice: '#7FC8CC',
    fighting: '#A3453E',
    poison: '#8F5A9C',
    ground: '#B9985A',
    flying: '#8F8ED6',
    psychic: '#D16C88',
    bug: '#8E9E3E',
    rock: '#A08A50',
    ghost: '#7C6AB0',
    dragon: '#6C4BCC',
    dark: '#5C4C44',
    steel: '#9BA9C0',
    fairy: '#D18EA6'
  };

  constructor(
    public pokemonUtils: PokemonUtilsService,
    private settingsService: SettingsService,
    @Self() @Optional() private interactiveHost?: InteractiveHostDirective
  ) { }

  ngOnInit() {
    this.darkModeSubscription = this.settingsService
      .watchSetting<boolean>('darkMode')
      .subscribe(isDark => {
        this.isDarkMode = isDark ?? false;
      });

    this.languageSubscription = this.pokemonUtils
      .watchLanguageChanges()
      .subscribe(() => {
        this.updateLocalizedTypeName();
        this.setNavigationLink();
      });

    this.updateLocalizedTypeName();
    this.setNavigationLink();
  }

  ngOnDestroy() {
    this.darkModeSubscription?.unsubscribe();
    this.languageSubscription?.unsubscribe();
  }

  updateLocalizedTypeName() {
    if (this.pokemonType?.pokemon_v2_typenames) {
      this.localizedTypeName = this.pokemonUtils.getNameByLanguage(
        this.pokemonType.pokemon_v2_typenames
      );
    } else {
      this.localizedTypeName = 'Unknown';
    }
  }

  setNavigationLink() {
    if (this.interactiveHost && this.localizedTypeName !== 'Unknown') {
      this.interactiveHost.href = ['/type', this.localizedTypeName.toLowerCase()];
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
