import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';

export interface PokeApiEncounterEntry {
  location_area: { name: string; url: string };
  version_details: PokeApiVersionEncounter[];
}

export interface PokeApiVersionEncounter {
  version: { name: string; url: string };
  max_chance: number;
  encounter_details: PokeApiEncounterDetail[];
}

export interface PokeApiEncounterDetail {
  min_level: number;
  max_level: number;
  chance: number;
  method: { name: string; url: string };
  condition_values: { name: string; url: string }[];
}

@Injectable({ providedIn: 'root' })
export class EncounterService {
  private cache = new Map<number, Observable<PokeApiEncounterEntry[]>>();

  constructor(private http: HttpClient) {}

  getEncounters(pokemonId: number): Observable<PokeApiEncounterEntry[]> {
    if (!this.cache.has(pokemonId)) {
      const obs = this.http
        .get<PokeApiEncounterEntry[]>(`https://pokeapi.co/api/v2/pokemon/${pokemonId}/encounters`)
        .pipe(catchError(() => of([])), shareReplay(1));
      this.cache.set(pokemonId, obs);
    }
    return this.cache.get(pokemonId)!;
  }
}
