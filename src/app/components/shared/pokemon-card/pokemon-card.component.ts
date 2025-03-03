import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { PokemonBgSvgComponent } from '../pokemon-bg-svg/pokemon-bg-svg.component';
import { PokemonUtilsService } from '../../../utils/pokemon-utils';
import { SettingsService } from '../../../services/settings.service';
import { Pokemon } from '../../../models/pokemon.model';
import { PokemonSpecies } from '../../../models/pokemon-species.model';

@Component({
  selector: 'app-pokemon-card',
  templateUrl: './pokemon-card.component.html',
  styleUrls: ['./pokemon-card.component.css'],
  imports: [CommonModule, PokemonBgSvgComponent],
  host: { 
    '(click)': 'navigateToPokemonDetails()'
  }
})
export class PokemonCardComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() pokemon!: Pokemon;
  @Input() pokemonSpecies!: PokemonSpecies;
  @ViewChild('pokemonImage', { static: false }) pokemonImage!: ElementRef<HTMLImageElement>;
  
  pokemonViewModel: { id: number; name: string; image: string; generation: string } = { id: 0, name: '', image: '', generation: '' };

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
    this.updateViewModel();
    this.languageSubscription = this.settingsService
      .watchSetting<number>('selectedLanguageId')
      .subscribe(() => {
        this.updateViewModel();
        this.cdr.detectChanges();
      });
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.languageSubscription.unsubscribe();
  }

  private updateViewModel(): void {
    this.pokemonViewModel = {
      id: this.pokemon?.id || this.pokemonSpecies?.id || 0,
      name: this.pokemonUtils.getPokemonSpeciesNameByLanguage(this.pokemonSpecies),
      image: this.pokemonUtils.getPokemonOfficialImage(this.pokemon),
      generation: this.pokemonUtils.parseGenerationName(this.pokemonSpecies?.pokemon_v2_generation?.pokemon_v2_generationnames),
    };
  }

  navigateToPokemonDetails(): void {
    if (this.pokemonViewModel.name) {
      this.router.navigate(['/pokemon', this.pokemonViewModel.name]);
    } else if (this.pokemonViewModel.id) {
      this.router.navigate(['/pokemon', this.pokemonViewModel.id]);
    } else {
      console.error('No valid Pokémon ID or name found.');
    }
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
