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
    const trimmedGuess = this.currentGuess.trim().toLowerCase();
    if (!trimmedGuess) return;

    // Check if this Pokémon exists in the dataset before guessing
    const matchedPokemon = Array.from(this.guessingGameStateService.allPokemonSpecies.values()).find(
      pokemon => pokemon.names?.find(x => x.name.trim().toLocaleLowerCase() === trimmedGuess)
    );

    if (matchedPokemon) {
        this.guessingGameStateService.guessPokemonByName(trimmedGuess);
        this.currentGuess = ''; // Reset input after a correct guess
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
