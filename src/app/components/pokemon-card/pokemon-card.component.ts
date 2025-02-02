import { Component, Input, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { PokemonSpecies } from '../../models/pokemon-species.model';
import { CommonModule } from '@angular/common';
import {
  getPokemonOfficialImage,
  getPokemonSpeciesNameByLanguage
} from '../../utils/pokemon-utils';

@Component({
  selector: 'app-pokemon-card',
  templateUrl: './pokemon-card.component.html',
  styleUrls: ['./pokemon-card.component.css'],
  imports: [CommonModule],
  host: { 
    '(click)': 'navigateToPokemonDetails()'
  }
})
export class PokemonCardComponent implements AfterViewInit {
  @Input() pokemonSpecies!: PokemonSpecies;

  constructor(private router: Router) {}

  ngAfterViewInit(): void {
    this.removeInitialLoad();
  }

  getPokemonImage(): string {
    return getPokemonOfficialImage(this.pokemonSpecies?.pokemon_v2_pokemons?.[0]) 
      || '/invalid/image.png';
  }

  getPokemonSpeciesName(): string {
    return getPokemonSpeciesNameByLanguage(this.pokemonSpecies, 'en');
  }

  parseGenerationName(generation: string | undefined): string {
    if (!generation) return 'Unknown Generation';
    const parts = generation.split('-');
    return parts.length === 2 ? `Generation ${parts[1].toUpperCase()}` : generation;
  }

  navigateToPokemonDetails(): void {
    const species = this.pokemonSpecies;
    const name = species?.pokemon_v2_pokemonspeciesnames?.[0]?.name;
  
    if (species?.id) {
      this.router.navigate(['/pokemon', species.id]);
    } else if (name) {
      this.router.navigate(['/pokemon', name]);
    } else {
      console.error('No valid Pokémon ID or name found.');
    }
  }  

  handleImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.src = 'images/egg.png';
    img.classList.add('shaking_egg');
  }  

  private removeInitialLoad(): void {
    setTimeout(() => {
      const images = document.querySelectorAll('.pokemonCard__image.initial-load');
      images.forEach(img => img.classList.remove('initial-load'));
    }, 600);
  }
}
