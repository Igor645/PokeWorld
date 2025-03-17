import { Component, Input, OnInit, OnDestroy, OnChanges, SimpleChanges, ElementRef, Renderer2 } from '@angular/core';
import { PokemonSpecies } from '../../../../models/pokemon-species.model';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { Pokemon } from '../../../../models/pokemon.model';
import { GuessingGameStateService } from '../services/guessing-game-state.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-guessing-pokemon-icon',
  standalone: true,
  templateUrl: './guessing-pokemon-icon.component.html',
  styleUrl: './guessing-pokemon-icon.component.css'
})
export class GuessingPokemonIconComponent implements OnInit, OnDestroy, OnChanges {
  @Input() pokemonSpecies: PokemonSpecies | undefined;
  @Input() disableSound: boolean = false;

  currentPokemon: Pokemon | undefined;
  
  private isDestroyed$ = new Subject<void>();

  state = {
    isSilhouette: false,
    isGuessed: false,
    imageLoaded: false,
    isSoundPlaying: false,
  };

  constructor(
    private pokemonUtils: PokemonUtilsService,
    private guessingGameStateService: GuessingGameStateService,
    private el: ElementRef,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    this.subscribeToState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pokemonSpecies']?.currentValue) {
      this.currentPokemon = this.pokemonUtils.getDefaultPokemon(this.pokemonSpecies);
      this.state.imageLoaded = false;
      this.updateStateOnChange();
    }
  }

  private subscribeToState(): void {
    this.guessingGameStateService.state$
      .pipe(takeUntil(this.isDestroyed$))
      .subscribe(() => this.updateStateOnChange());
  }

  private updateStateOnChange(): void {
    if (!this.pokemonSpecies) return;

    const { isSilhouette, guessedPokemonIds } = this.guessingGameStateService.currentState;

    const wasAlreadyGuessed = this.state.isGuessed;
    this.state.isSilhouette = isSilhouette;
    this.state.isGuessed = guessedPokemonIds.has(this.pokemonSpecies.id);

    if (!wasAlreadyGuessed && this.state.isGuessed && this.state.imageLoaded) {
      this.applyPopInAnimation();
    }
  }

  getPokemonDefaultImage(): string {
    return this.state.isGuessed || this.state.isSilhouette
      ? this.pokemonUtils.getPokemonDefaultImage(this.currentPokemon)
      : '/images/not-guessed.svg';
  }

  onImageLoad(): void {
    this.state.imageLoaded = true;
    if (this.state.isGuessed && !this.state.isSilhouette) {
      this.applyPopInAnimation();
    }
  }

  applyPopInAnimation(): void {
    const element = this.el.nativeElement.querySelector('.pokemon-icon');
    this.playClickSound();
    this.renderer.addClass(element, 'pop-in');

    setTimeout(() => {
      this.renderer.removeClass(element, 'pop-in');
    }, 250);
  }

  playClickSound(): void {
    if (this.state.isSoundPlaying || this.disableSound) return;

    this.state.isSoundPlaying = true;
    const audio = new Audio('/sounds/click.mp3');
    audio.volume = 0.3;

    audio.play()
      .then(() => setTimeout(() => (this.state.isSoundPlaying = false), 250))
      .catch(err => console.error("Error playing sound:", err));
  }

  ngOnDestroy(): void {
    this.isDestroyed$.next();
    this.isDestroyed$.complete();
  }
}
