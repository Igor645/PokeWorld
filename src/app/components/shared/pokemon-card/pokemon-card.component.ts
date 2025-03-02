import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { PokemonSpecies } from '../../../models/pokemon-species.model';
import { CommonModule } from '@angular/common';
import { PokemonUtilsService } from '../../../utils/pokemon-utils';
import { SettingsService } from '../../../services/settings.service';
import { Subscription } from 'rxjs';
import { PokemonBgSvgComponent } from '../pokemon-bg-svg/pokemon-bg-svg.component';

@Component({
  selector: 'app-pokemon-card',
  templateUrl: './pokemon-card.component.html',
  styleUrls: ['./pokemon-card.component.css'],
  imports: [CommonModule, PokemonBgSvgComponent],
  host: { 
    '(click)': 'navigateToPokemonDetails()'
  }
})
export class PokemonCardComponent implements OnInit, OnDestroy {
  @Input() pokemonSpecies!: PokemonSpecies;
  pokemonName: string = '';
  generationName: string = '';
  imageLoaded: boolean = false;
  eggGone: boolean = false;
  eggSwooping: boolean = false;
  private languageSubscription!: Subscription;

  constructor(
    private router: Router, 
    private pokemonUtils: PokemonUtilsService,
    private settingsService: SettingsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.updatePokemonName();
    this.languageSubscription = this.settingsService
      .watchSetting<number>('selectedLanguageId')
      .subscribe(() => {
        this.updatePokemonName();
        this.updateGenerationName();
        this.cdr.detectChanges();
      });
  }

  ngOnDestroy(): void {
    this.languageSubscription.unsubscribe();
  }

  updatePokemonName(): void {
    this.pokemonName = this.pokemonUtils.getPokemonSpeciesNameByLanguage(this.pokemonSpecies);
  }

  getPokemonImage(): string {
    return this.pokemonUtils.getPokemonOfficialImage(
      this.pokemonSpecies?.pokemon_v2_pokemons?.[0]
    ) || '/invalid/image.png';
  }

  updateGenerationName(): void {
    this.generationName = this.pokemonUtils.parseGenerationName(
      this.pokemonSpecies?.pokemon_v2_generation?.pokemon_v2_generationnames
    );
  }

  navigateToPokemonDetails(): void {
    const species = this.pokemonSpecies;
    const name = this.pokemonName;
    if (name) {
      this.router.navigate(['/pokemon', name]);
    } else if (species?.id) {
      this.router.navigate(['/pokemon', species.id]);
    } else {
      console.error('No valid Pokémon ID or name found.');
    }
  }  

  onImageLoad(): void {
    console.log('Image has loaded.');
    this.imageLoaded = true;
    this.eggSwooping = true;
    this.cdr.detectChanges();
  }

  onEggAnimationEnd(): void {
    console.log('Egg animation ended.');
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
