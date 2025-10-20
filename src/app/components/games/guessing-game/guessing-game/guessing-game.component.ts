import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { GenerationService } from '../../../../services/generation.service';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { GenerationContainerComponent } from '../generation-container/generation-container.component';
import { GuessingGameStateService } from '../services/guessing-game-state.service';
import { FormsModule } from '@angular/forms';
import { GuessingPokemonIconComponent } from '../guessing-pokemon-icon/guessing-pokemon-icon.component';

@Component({
  selector: 'app-guessing-game',
  standalone: true,
  imports: [CommonModule, FormsModule, GenerationContainerComponent, GuessingPokemonIconComponent],
  templateUrl: './guessing-game.component.html',
  styleUrl: './guessing-game.component.css'
})
export class GuessingGameComponent implements OnInit {
  generations: any[] = [];
  completedGenerations = new Set<number>();
  currentGuess: string = '';
  toastMessage: string = '';
  showToast: boolean = false;
  lastGuessedPokemonId: number | null = null;

  constructor(
    private generationService: GenerationService,
    private pokemonUtils: PokemonUtilsService,
    public guessingGameStateService: GuessingGameStateService,
    @Inject(PLATFORM_ID) private platformId: object
  ) { }

  ngOnInit(): void {
    this.fetchGenerations();
    this.guessingGameStateService.state$.subscribe(state => {
      this.completedGenerations = state.completedGenerations;
      this.lastGuessedPokemonId = state.lastGuessedPokemonId;
    });
  }

  onGuessInput(): void {
    const result = this.guessingGameStateService.guessPokemonByName(this.currentGuess);

    if (result.message) {
      this.showToastMessage(result.message);
    }

    if (result.message || result.guessed) {
      this.currentGuess = '';
    }
  }

  showToastMessage(message: string): void {
    this.toastMessage = message;
    this.showToast = true;
    setTimeout(() => this.showToast = false, 2000);
  }

  private fetchGenerations(): void {
    this.generationService.getGenerations().subscribe(response => {
      this.generations = response.generation;
    });
  }

  getRegionName(region: any): string {
    return this.pokemonUtils.getNameByLanguage(region.regionnames);
  }

  toggleSilhouette(): void {
    this.guessingGameStateService.toggleSilhouette();
  }
}
