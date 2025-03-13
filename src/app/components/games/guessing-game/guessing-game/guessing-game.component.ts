import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { GenerationService } from '../../../../services/generation.service';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { GenerationContainerComponent } from '../generation-container/generation-container.component';
import { GuessingGameStateService } from '../services/guessing-game-state.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-guessing-game',
  standalone: true,
  imports: [CommonModule, FormsModule, GenerationContainerComponent],
  templateUrl: './guessing-game.component.html',
  styleUrl: './guessing-game.component.css'
})
export class GuessingGameComponent implements OnInit {
  generations: any[] = [];
  completedGenerations = new Set<number>();
  currentGuess: string = '';

  constructor(
    private generationService: GenerationService,
    private pokemonUtils: PokemonUtilsService,
    public guessingGameStateService: GuessingGameStateService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit(): void {
    this.fetchGenerations();

    this.guessingGameStateService.completedGenerations$.subscribe(completed => {
      this.completedGenerations = completed;
    });
  }

  onGuessInput(): void {
    const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase(); // Removes special chars
  
    const trimmedGuess = sanitize(this.currentGuess.trim());
    if (!trimmedGuess) return;
  
    const guessedSet = this.guessingGameStateService.guessedPokemonIds.value;
  
    const exactMatch = Array.from(this.guessingGameStateService.allPokemonSpecies.entries()).find(
      ([id, pokemon]) => 
        pokemon.names.some(name => sanitize(name.name) === trimmedGuess)
    );
  
    if (exactMatch && !guessedSet.has(exactMatch[0])) {
      this.guessingGameStateService.guessPokemon(exactMatch[0]);
      this.currentGuess = '';
      return;
    }
  
    const matchingPokemon = Array.from(this.guessingGameStateService.allPokemonSpecies.entries()).filter(
      ([id, pokemon]) => 
        pokemon.names.some(name => sanitize(name.name).startsWith(trimmedGuess))
    );
  
    const unguessedPokemon = matchingPokemon.filter(([id]) => !guessedSet.has(id));
  
    if (unguessedPokemon.length === 1 && 
        unguessedPokemon[0][1].names.some(name => sanitize(name.name) === trimmedGuess)) {
      this.guessingGameStateService.guessPokemon(unguessedPokemon[0][0]);
      this.currentGuess = '';
    }
  }  

  private fetchGenerations(): void {
    this.generationService.getGenerations().subscribe(response => {
      this.generations = response.pokemon_v2_generation;
    });
  }

  getRegionName(region: any): string {
    return this.pokemonUtils.getNameByLanguage(region.pokemon_v2_regionnames);
  }

  toggleSilhouette(): void {
    this.guessingGameStateService.toggleSilhouette();
  }
}
