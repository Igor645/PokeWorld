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
import { Router } from '@angular/router';
import { getNameByLanguage } from '../../utils/pokemon-utils';

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
    private cdr: ChangeDetectorRef,
    private router: Router
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

  onOptionSelected(event: any) {
    const selectedItem = event.option.value;
  
    if (!selectedItem) return;
  
    console.log("Selected Item:", selectedItem);
  
    if ('pokemon_v2_pokemonspeciesnames' in selectedItem) {
      this.router.navigate(['/pokemon', this.getPokemonName(selectedItem)]);
    } else {
      console.warn("Unknown selection type:", selectedItem);
    }
  }
  
  getPokemonName(species: PokemonSpecies): string {
    return getNameByLanguage(species.pokemon_v2_pokemonspeciesnames, "en")
  }  
  
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
