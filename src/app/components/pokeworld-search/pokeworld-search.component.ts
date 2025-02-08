import { Component, ChangeDetectorRef, AfterViewInit, OnDestroy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CommonModule } from '@angular/common';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { PokemonService } from '../../services/pokemon.service';
import { PokemonSpecies } from '../../models/pokemon-species.model';
import { getPokemonOfficialImage } from '../../utils/pokemon-utils';
import { PokeworldSearchItemComponent } from '../pokeworld-search-item/pokeworld-search-item.component';
import { Name } from '../../models/species-name.model';

@Component({
  selector: 'app-pokeworld-search',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    PokeworldSearchItemComponent
  ],
  templateUrl: './pokeworld-search.component.html',
  styleUrls: ['./pokeworld-search.component.css']
})
export class PokeworldSearchComponent implements AfterViewInit, OnDestroy {
  searchControl = new FormControl('');
  filteredPokemonSpecies: PokemonSpecies[] = [];

  constructor(
    private pokemonService: PokemonService,
    private cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit() {
    this.pokemonService.getPokemonSpeciesByPrefix("").subscribe({
      next: (response) => {
        this.filteredPokemonSpecies = response.pokemon_v2_pokemonspecies || [];
        this.cdr.markForCheck();
      },
      error: (error) => console.error('Error fetching initial Pokémon:', error),
    });
  
    this.searchControl.valueChanges.pipe(
      debounceTime(100),
      distinctUntilChanged(),
      switchMap(searchQuery => this.pokemonService.getPokemonSpeciesByPrefix(searchQuery || ""))
    ).subscribe({
      next: (response) => {
        this.filteredPokemonSpecies = response.pokemon_v2_pokemonspecies || [];
        this.cdr.markForCheck();
      },
      error: (error) => console.error('Error searching Pokémon:', error),
    });
  }
  

  ngOnDestroy() {}

  GetPokemonOfficialImage(pokemon: any) {
    return getPokemonOfficialImage(pokemon);
  }

  trackByPokemon(index: number, item: PokemonSpecies): number {
    return item.id;
  }

  getCategoryNames(name: string, language: string): Name[] {
    return [{
      name: name,
      pokemon_v2_language: {
        name: language,
        id: 0,
      }
    }];
  }  
}
