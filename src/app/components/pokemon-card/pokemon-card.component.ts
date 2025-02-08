import { Component, Input, AfterViewInit, ElementRef, ViewChild, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { PokemonSpecies } from '../../models/pokemon-species.model';
import { CommonModule } from '@angular/common';
import { PokemonUtilsService } from '../../utils/pokemon-utils';
import { SettingsService } from '../../services/settings.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-pokemon-card',
  templateUrl: './pokemon-card.component.html',
  styleUrls: ['./pokemon-card.component.css'],
  imports: [CommonModule],
  host: { 
    '(click)': 'navigateToPokemonDetails()'
  }
})
export class PokemonCardComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() pokemonSpecies!: PokemonSpecies;
  @ViewChild('imgContainer', { static: true }) imgContainerRef!: ElementRef;

  pokemonName: string = '';
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
        this.cdr.detectChanges();
      });
  }

  ngAfterViewInit(): void {
    this.removeInitialLoad();
  }

  ngOnDestroy(): void {
    this.languageSubscription.unsubscribe();
  }

  updatePokemonName(): void {
    this.pokemonName = this.pokemonUtils.getPokemonSpeciesNameByLanguage(this.pokemonSpecies);
  }

  getPokemonImage(): string {
    return this.pokemonUtils.getPokemonOfficialImage(this.pokemonSpecies?.pokemon_v2_pokemons?.[0]) 
      || '/invalid/image.png';
  }

  parseGenerationName(generation: string | undefined): string {
    if (!generation) return 'Unknown Generation';
    const parts = generation.split('-');
    return parts.length === 2 ? `Generation ${parts[1].toUpperCase()}` : generation;
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

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'images/egg.png';
    img.classList.add('shaking_egg');
  }  

  private removeInitialLoad(): void {
    setTimeout(() => {
      if (this.imgContainerRef) {
        const images = this.imgContainerRef.nativeElement.querySelectorAll('.pokemonCard__image.initial-load');
        images.forEach((img: HTMLElement) => img.classList.remove('initial-load'));
      }
    }, 600);
  }
}
