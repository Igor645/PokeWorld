import {
  Component,
  OnInit,
  Input,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  Optional,
  Self
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { Pokemon } from '../../../models/pokemon.model';
import { PokemonSpecies } from '../../../models/pokemon-species.model';
import { PokemonUtilsService } from '../../../utils/pokemon-utils';
import { SettingsService } from '../../../services/settings.service';
import { PokemonBgSvgComponent } from '../pokemon-bg-svg/pokemon-bg-svg.component';
import { InteractiveHostDirective } from '../directives/interactive-host.directive';
import { PokemonTypeComponent } from '../pokemon-type/pokemon-type.component';

const REGIONAL_SUFFIXES = ['alola', 'galar', 'hisui', 'paldea'];

@Component({
  selector: 'app-pokemon-card',
  templateUrl: './pokemon-card.component.html',
  styleUrls: ['./pokemon-card.component.css'],
  standalone: true,
  imports: [CommonModule, PokemonBgSvgComponent, PokemonTypeComponent],
  hostDirectives: [InteractiveHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PokemonCardComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() pokemon!: Pokemon;
  @Input() pokemonSpecies!: PokemonSpecies;
  @Input() showTypes = false;
  @Input() showRegion = false;

  @ViewChild('pokemonImage', { static: false }) pokemonImage!: ElementRef<HTMLImageElement>;

  pokemonViewModel = { id: 0, name: '', image: '', generation: '' };
  imageLoaded = false;
  eggGone = false;
  eggSwooping = false;
  private languageSubscription!: Subscription;

  get regionLabel(): string | null {
    if (!this.showRegion || !this.pokemon || this.pokemon.is_default) return null;
    const suffix = REGIONAL_SUFFIXES.find(s => this.pokemon.name.endsWith(`-${s}`));
    return suffix ? suffix.charAt(0).toUpperCase() + suffix.slice(1) : null;
  }

  constructor(
    private pokemonUtils: PokemonUtilsService,
    private settingsService: SettingsService,
    private cdr: ChangeDetectorRef,
    @Self() @Optional() private interactiveHost?: InteractiveHostDirective
  ) { }

  ngOnInit(): void {
    this.updateViewModel();

    if (this.interactiveHost) {
      const name = this.pokemonViewModel.name || this.pokemonViewModel.id;
      this.interactiveHost.href = ['/pokemon', name];
    }

    this.languageSubscription = this.settingsService
      .watchSetting<number>('selectedLanguageId')
      .subscribe(() => {
        this.updateViewModel();
        this.cdr.detectChanges();
      });
  }

  ngAfterViewInit(): void { }

  ngOnDestroy(): void {
    this.languageSubscription.unsubscribe();
  }

  private updateViewModel(): void {
    this.pokemonViewModel = {
      id: this.pokemon?.id || this.pokemonSpecies?.id || 0,
      name: this.pokemonUtils.getLocalizedNameFromEntity(this.pokemonSpecies, 'pokemonspeciesnames') || 'Unknown',
      image: this.pokemonUtils.getPokemonOfficialImage(this.pokemon),
      generation: this.pokemonUtils.getLocalizedNameFromEntity(this.pokemonSpecies.generation, 'generationnames') || 'Unknown',
    };
  }

  get pokemonTypes(): any[] {
    return this.pokemon?.pokemontypes ?? [];
  }

  onImageLoad(): void {
    this.imageLoaded = true;
    setTimeout(() => {
      this.pokemonImage.nativeElement.classList.remove('initial-load');
    }, 700);
    this.eggSwooping = true;
    this.cdr.detectChanges();
  }

  onEggAnimationEnd(): void {
    this.eggGone = true;
    this.eggSwooping = false;
    this.cdr.detectChanges();
  }

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/images/egg.png';
    img.classList.add('shaking_egg');
  }
}
