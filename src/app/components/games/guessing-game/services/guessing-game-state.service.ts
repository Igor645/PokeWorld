import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Name } from '../../../../models/species-name.model';

interface GuessingGameState {
  isSilhouette: boolean;
  guessedPokemonIds: Set<number>;
  foundPokemonCount: number;
  completedGenerations: Set<number>;
}

@Injectable({
  providedIn: 'root'
})
export class GuessingGameStateService {
  private state = new BehaviorSubject<GuessingGameState>({
    isSilhouette: false,
    guessedPokemonIds: new Set(),
    foundPokemonCount: 0,
    completedGenerations: new Set()
  });

  get state$(): Observable<GuessingGameState> {
    return this.state.asObservable();
  }

  get currentState(): GuessingGameState {
    return this.state.value;
  }

  public allPokemonSpecies = new Map<number, { name: string; genId: number; names: Name[] }>();

  /**
   * Updates the state while preserving immutability
   */
  private updateState(partialState: Partial<GuessingGameState>): void {
    this.state.next({ ...this.state.value, ...partialState });
  }

  /**
   * Registers all Pokémon species when fetched
   */
  registerPokemon(speciesId: number, name: string, generationId: number, speciesNames: Name[]): void {
    this.allPokemonSpecies.set(speciesId, { name: name.toLowerCase(), genId: generationId, names: speciesNames });
  }

  /**
   * Handles guessing Pokémon by species ID
   */
  guessPokemon(speciesId: number): void {
    if (!this.allPokemonSpecies.has(speciesId)) return; // Ignore invalid IDs

    const { guessedPokemonIds, foundPokemonCount } = this.currentState;

    if (guessedPokemonIds.has(speciesId)) return; // Already guessed

    const updatedGuessedSet = new Set(guessedPokemonIds);
    updatedGuessedSet.add(speciesId);

    this.updateState({
      guessedPokemonIds: updatedGuessedSet,
      foundPokemonCount: foundPokemonCount + 1
    });

    const pokemon = this.allPokemonSpecies.get(speciesId);
    if (pokemon) this.checkCompletedGeneration(pokemon.genId);
  }

  /**
   * Handles guessing Pokémon by name (for input guesses)
   */
  guessPokemonByName(name: string): { guessed: boolean; message?: string } {
    const sanitize = (str: string) => 
      str
          .normalize("NFD")
          .replace(/[^a-zA-Z0-9ß]/g, '')
          .replace(/ß/g, 'ss')
          .toLowerCase();
          
    const trimmedGuess = sanitize(name.trim());
    if (!trimmedGuess) return { guessed: false };

    const guessedSet = this.currentState.guessedPokemonIds;

    // Find exact matches
    const exactMatches = Array.from(this.allPokemonSpecies.entries()).filter(
      ([id, pokemon]) => pokemon.names.some(n => sanitize(n.name) === trimmedGuess)
    );

    const newExactGuesses = exactMatches.filter(([id]) => !guessedSet.has(id));

    if (newExactGuesses.length > 0) {
      newExactGuesses.forEach(([id]) => this.guessPokemon(id));
      return { guessed: true };
    }

    // Find all Pokémon that start with this input
    const matchingPokemon = Array.from(this.allPokemonSpecies.entries()).filter(
      ([id, pokemon]) => 
        pokemon.names.some(n => sanitize(n.name).startsWith(trimmedGuess))
    );

    // Filter only unguessed Pokémon
    const unguessedPokemon = matchingPokemon.filter(([id]) => !guessedSet.has(id));

    // If there's **only one** unguessed Pokémon left with this prefix, submit it
    if (unguessedPokemon.length === 1 &&
        unguessedPokemon[0][1].names.some(n => sanitize(n.name) === trimmedGuess)) {
      this.guessPokemon(unguessedPokemon[0][0]);
      return { guessed: true };
    }

    // If an exact match exists but has already been guessed AND no other unguessed Pokémon share the prefix
    if (exactMatches.length > 0 && unguessedPokemon.length === 0) {
      return { guessed: false, message: `${trimmedGuess} has already been guessed!` };
    }

    return { guessed: false };
  }

  /**
   * Checks if an entire generation has been guessed
   */
  private checkCompletedGeneration(generationId: number): void {
    const { guessedPokemonIds, completedGenerations } = this.currentState;
    const totalInGen = Array.from(this.allPokemonSpecies.values()).filter(p => p.genId === generationId).length;
    const guessedInGen = Array.from(guessedPokemonIds).filter(id => this.allPokemonSpecies.get(id)?.genId === generationId).length;

    if (guessedInGen === totalInGen) {
      const updatedCompletedSet = new Set(completedGenerations);
      updatedCompletedSet.add(generationId);
      this.updateState({ completedGenerations: updatedCompletedSet });
    }
  }

  /**
   * Toggles the silhouette mode for all Pokémon
   */
  toggleSilhouette(): void {
    this.updateState({ isSilhouette: !this.currentState.isSilhouette });
  }
}
