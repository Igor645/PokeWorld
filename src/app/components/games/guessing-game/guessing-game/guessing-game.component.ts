import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { GenerationService } from '../../../../services/generation.service';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { GenerationContainerComponent } from '../generation-container/generation-container.component';
import { GuessingGameStateService } from '../services/guessing-game-state.service';

@Component({
  selector: 'app-guessing-game',
  standalone: true,
  imports: [CommonModule, GenerationContainerComponent],
  templateUrl: './guessing-game.component.html',
  styleUrl: './guessing-game.component.css'
})
export class GuessingGameComponent implements OnInit {
  generations: any[] = [];

  constructor(
    private generationService: GenerationService,
    private pokemonUtils: PokemonUtilsService,
    private guessingGameStateService: GuessingGameStateService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit(): void {
    this.fetchGenerations();
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
