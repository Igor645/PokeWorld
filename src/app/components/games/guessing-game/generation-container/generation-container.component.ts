import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PokemonService } from '../../../../services/pokemon.service';
import { GuessingPokemonIconComponent } from '../guessing-pokemon-icon/guessing-pokemon-icon.component';
import { PokemonSpecies } from '../../../../models/pokemon-species.model';
import { GuessingGameStateService } from '../services/guessing-game-state.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-generation-container',
  standalone: true,
  imports: [CommonModule, GuessingPokemonIconComponent],
  templateUrl: './generation-container.component.html',
  styleUrl: './generation-container.component.css'
})
export class GenerationContainerComponent implements OnInit, OnDestroy {
  @Input() generationId!: number;
  @Input() generationName!: string;
  pokemonList: PokemonSpecies[] = [];
  completed = false;
  private destroy$ = new Subject<void>();

  constructor(private pokemonService: PokemonService, private guessingGameStateService: GuessingGameStateService) {}

  ngOnInit(): void {
    this.fetchPokemonByGeneration();

    this.guessingGameStateService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.completed = state.completedGenerations.has(this.generationId);
      });
  }

  private fetchPokemonByGeneration(): void {
    this.pokemonService.getPokemonSpeciesByGenerationId(this.generationId).subscribe(response => {
      this.pokemonList = response.pokemon_v2_pokemonspecies;

      this.pokemonList.forEach(pokemon => {
        this.guessingGameStateService.registerPokemon(
          pokemon.id, 
          pokemon.name, 
          this.generationId, 
          pokemon.pokemon_v2_pokemonspeciesnames
        );
      });
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
