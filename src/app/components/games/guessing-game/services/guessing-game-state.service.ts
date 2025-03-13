import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Name } from '../../../../models/species-name.model';

@Injectable({
  providedIn: 'root'
})
export class GuessingGameStateService {
  private isSilhouetteSubject = new BehaviorSubject<boolean>(false);
  get isSilhouette$(): Observable<boolean> {
    return this.isSilhouetteSubject.asObservable();
  }

  public guessedPokemonIds = new BehaviorSubject<Set<number>>(new Set());
  get guessedPokemonIds$(): Observable<Set<number>> {
    return this.guessedPokemonIds.asObservable();
  }

  private foundPokemonCount = new BehaviorSubject<number>(0);
  get foundPokemonCount$(): Observable<number> {
    return this.foundPokemonCount.asObservable();
  }

  private completedGenerations = new BehaviorSubject<Set<number>>(new Set());
  get completedGenerations$(): Observable<Set<number>> {
    return this.completedGenerations.asObservable();
  }

  public allPokemonSpecies = new Map<number, { name: string; genId: number; names: Name[] }>(); // Pokémon registry

  /**
   * Registers all Pokémon species when fetched
   */
  registerPokemon(speciesId: number, name: string, generationId: number, speciesNames: Name[]): void {
    console.log(speciesNames)
    this.allPokemonSpecies.set(speciesId, { name: name.toLowerCase(), genId: generationId, names: speciesNames});
  }

  /**
   * Handles guessing Pokémon by species ID
   */
  guessPokemon(speciesId: number): void {
    if (!this.allPokemonSpecies.has(speciesId)) return; // Ignore invalid IDs

    const guessedSet = new Set(this.guessedPokemonIds.value);
    if (guessedSet.has(speciesId)) return; // Already guessed

    guessedSet.add(speciesId);
    this.guessedPokemonIds.next(guessedSet);
    this.foundPokemonCount.next(guessedSet.size);

    const pokemon = this.allPokemonSpecies.get(speciesId);
    if (pokemon) this.checkCompletedGeneration(pokemon.genId);
  }

  /**
   * Handles guessing Pokémon by name (for input guesses)
   */
  guessPokemonByName(name: string): void {
    let found = false;
    this.allPokemonSpecies.forEach((pokemon, id) => {
      if (pokemon.names.find(x => x.name.toLowerCase() === name.toLowerCase())) {
        this.guessPokemon(id);
        found = true;
      }
    });

    if (!found) {
      console.log("Pokémon not found:", name);
    }
  }

  /**
   * Checks if an entire generation has been guessed
   */
  private checkCompletedGeneration(generationId: number): void {
    const totalInGen = Array.from(this.allPokemonSpecies.values()).filter(p => p.genId === generationId).length;
    const guessedInGen = Array.from(this.guessedPokemonIds.value).filter(id => this.allPokemonSpecies.get(id)?.genId === generationId).length;

    if (guessedInGen === totalInGen) {
      const completedSet = new Set(this.completedGenerations.value);
      completedSet.add(generationId);
      this.completedGenerations.next(completedSet);
    }
  }

  /**
   * Toggles the silhouette mode for all Pokémon
   */
  toggleSilhouette(): void {
    this.isSilhouetteSubject.next(!this.isSilhouetteSubject.value);
  }
}
