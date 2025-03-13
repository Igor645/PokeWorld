import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { PokemonSpecies } from '../../../../models/pokemon-species.model';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { Pokemon } from '../../../../models/pokemon.model';
import { GuessingGameStateService } from '../services/guessing-game-state.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-guessing-pokemon-icon',
  standalone: true,
  imports: [],
  templateUrl: './guessing-pokemon-icon.component.html',
  styleUrl: './guessing-pokemon-icon.component.css'
})
export class GuessingPokemonIconComponent implements OnInit, OnDestroy {
  @Input() pokemonSpecies: PokemonSpecies | undefined;
  currentPokemon: Pokemon | undefined;
  isSilhouette: boolean = false;
  isGuessed: boolean = false;

  private isDestroyed$ = new Subject<void>();

  constructor(
    private pokemonUtils: PokemonUtilsService,
    private guessingGameStateService: GuessingGameStateService
  ) {}

  ngOnInit(): void {
    this.guessingGameStateService.state$
      .pipe(takeUntil(this.isDestroyed$))
      .subscribe(state => {
        this.isSilhouette = state.isSilhouette;
      });
    
    this.guessingGameStateService.state$
    .pipe(takeUntil(this.isDestroyed$))
    .subscribe(state => {
      if (this.pokemonSpecies) {
        this.isGuessed = state.guessedPokemonIds.has(this.pokemonSpecies.id);
      }
    });

    this.currentPokemon = this.pokemonUtils.getDefaultPokemon(this.pokemonSpecies);
  }

  getPokemonDefaultImage(): string {
    return this.isGuessed || this.isSilhouette
      ? this.pokemonUtils.getPokemonDefaultImage(this.currentPokemon)
      : '/images/not-guessed.svg';
  }

  guessPokemon(name: string): void {
    if (this.pokemonSpecies && this.pokemonSpecies.name.toLowerCase() === name.toLowerCase()) {
      this.isGuessed = true;
    }
  }

  ngOnDestroy(): void {
    this.isDestroyed$.next();
    this.isDestroyed$.complete();
  }
}
