import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { PokemonSpecies } from '../../../../models/pokemon-species.model';

interface GuessingGameState {
  isSilhouette: boolean;
  guessedPokemonIds: Set<number>;
  foundPokemonCount: number;
  completedGenerations: Set<number>;
  lastGuessedPokemonId: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class GuessingGameStateService {
  private state = new BehaviorSubject<GuessingGameState>({
    isSilhouette: false,
    guessedPokemonIds: new Set(),
    foundPokemonCount: 0,
    completedGenerations: new Set(),
    lastGuessedPokemonId: null
  });

  get state$(): Observable<GuessingGameState> {
    return this.state.asObservable();
  }

  get currentState(): GuessingGameState {
    return this.state.value;
  }

  private allPokemonSpecies = new Map<number, PokemonSpecies>();

  /** Updates the state while preserving immutability */
  private updateState(partialState: Partial<GuessingGameState>): void {
    this.state.next({ ...this.state.value, ...partialState });
  }

  /** Registers a Pokémon species */
  registerPokemon(pokemonSpecies: PokemonSpecies): void {
    this.allPokemonSpecies.set(pokemonSpecies.id, pokemonSpecies);
  }

  /** Guesses a Pokémon by ID */
  guessPokemon(speciesId: number): void {
    if (!this.allPokemonSpecies.has(speciesId) || this.currentState.guessedPokemonIds.has(speciesId)) return;

    const updatedGuessedSet = new Set(this.currentState.guessedPokemonIds).add(speciesId);

    this.updateState({
      guessedPokemonIds: updatedGuessedSet,
      foundPokemonCount: updatedGuessedSet.size,
      lastGuessedPokemonId: speciesId
    });

    this.checkCompletedGeneration(this.allPokemonSpecies.get(speciesId)?.pokemon_v2_generation.id);
  }

  /** Cleans and normalizes input names */
  private sanitizeName(name: string): string {
    return name
      .normalize("NFD")
      .replace(/[^a-zA-Z0-9ß]/g, '')
      .replace(/ß/g, 'ss')
      .toLowerCase();
  }

  /** Guesses a Pokémon by name */
  guessPokemonByName(name: string): { guessed: boolean; message?: string } {
    const trimmedGuess = this.sanitizeName(name.trim());
    if (!trimmedGuess) return { guessed: false };

    const guessedSet = this.currentState.guessedPokemonIds;

    const allMatches = Array.from(this.allPokemonSpecies.entries()).filter(([id, pokemon]) =>
      pokemon.pokemon_v2_pokemonspeciesnames.some(n => this.sanitizeName(n.name) === trimmedGuess)
    );

    const unguessedMatches = allMatches.filter(([id]) => !guessedSet.has(id));

    if (unguessedMatches.length > 0) {
      unguessedMatches.forEach(([id]) => this.guessPokemon(id));
      return { guessed: true };
    }

    const partialMatches = Array.from(this.allPokemonSpecies.entries()).filter(([id, pokemon]) =>
      pokemon.pokemon_v2_pokemonspeciesnames.some(n => this.sanitizeName(n.name).startsWith(trimmedGuess))
    );

    const unguessedPartialMatches = partialMatches.filter(([id]) => !guessedSet.has(id));

    if (unguessedPartialMatches.length === 1 &&
        unguessedPartialMatches[0][1].pokemon_v2_pokemonspeciesnames.some(n => this.sanitizeName(n.name) === trimmedGuess)) {
      this.guessPokemon(unguessedPartialMatches[0][0]);
      return { guessed: true };
    }

    if (allMatches.length > 0 && unguessedPartialMatches.length === 0) {
      return { guessed: false, message: `${trimmedGuess} has already been guessed!` };
    }

    return { guessed: false };
  }

  /** Checks if an entire generation has been guessed */
  private checkCompletedGeneration(generationId?: number): void {
    if (!generationId) return;

    const totalInGen = Array.from(this.allPokemonSpecies.values()).filter(p => p.pokemon_v2_generation.id === generationId).length;
    const guessedInGen = Array.from(this.currentState.guessedPokemonIds).filter(id => this.allPokemonSpecies.get(id)?.pokemon_v2_generation.id === generationId).length;

    if (guessedInGen === totalInGen) {
      const updatedCompletedSet = new Set(this.currentState.completedGenerations).add(generationId);
      this.updateState({ completedGenerations: updatedCompletedSet });
    }
  }

  /** Toggles the silhouette mode */
  toggleSilhouette(): void {
    this.updateState({ isSilhouette: !this.currentState.isSilhouette });
  }

  /** Retrieves a Pokémon by species ID */
  getPokemonById(speciesId: number): PokemonSpecies | undefined {
    return this.allPokemonSpecies.get(speciesId);
  }
}
