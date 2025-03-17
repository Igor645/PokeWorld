import { Component, Input, OnInit, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
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
  isSoundPlaying: boolean = false;
  imageLoaded: boolean = false;

  private isDestroyed$ = new Subject<void>();

  constructor(
    private pokemonUtils: PokemonUtilsService,
    private guessingGameStateService: GuessingGameStateService,
    private el: ElementRef,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    this.guessingGameStateService.state$
      .pipe(takeUntil(this.isDestroyed$))
      .subscribe(state => {
        this.isSilhouette = state.isSilhouette;

        if (this.pokemonSpecies) {
          const wasAlreadyGuessed = this.isGuessed;
          this.isGuessed = state.guessedPokemonIds.has(this.pokemonSpecies.id);

          if (!wasAlreadyGuessed && this.isGuessed && this.imageLoaded) {
            this.applyPopInAnimation();
          }
        }
      });

    this.currentPokemon = this.pokemonUtils.getDefaultPokemon(this.pokemonSpecies);
  }

  getPokemonDefaultImage(): string {
    return this.isGuessed || this.isSilhouette
      ? this.pokemonUtils.getPokemonDefaultImage(this.currentPokemon)
      : '/images/not-guessed.svg';
  }

  onImageLoad(): void {
    this.imageLoaded = true;

    if (this.isGuessed && !this.isSilhouette) {
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
    if (this.isSoundPlaying) return;

    this.isSoundPlaying = true; 

    const audio = new Audio('/sounds/click.mp3');
    audio.volume = 0.3;
    
    audio.play()
      .then(() => {
        setTimeout(() => {
          this.isSoundPlaying = false;
        }, 250);
      })
      .catch(err => console.error("Error playing sound:", err));
  }


  ngOnDestroy(): void {
    this.isDestroyed$.next();
    this.isDestroyed$.complete();
  }
}
