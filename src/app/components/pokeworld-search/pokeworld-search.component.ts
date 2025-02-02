import { 
  Component, Inject, PLATFORM_ID, ElementRef, ViewChild, ChangeDetectorRef, AfterViewInit, OnDestroy 
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PokemonService } from '../../services/pokemon.service';
import { PokemonSpecies } from '../../models/pokemon-species.model';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import {getPokemonOfficialImage, getPokemonSpeciesNameByLanguage} from '../../utils/pokemon-utils';
import { Pokemon } from '../../models/pokemon.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-pokeworld-search',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pokeworld-search.component.html',
  styleUrls: ['./pokeworld-search.component.css'],
})
export class PokeworldSearchComponent implements AfterViewInit, OnDestroy {
  filteredPokemonSpecies: PokemonSpecies[] = [];
  showDropdown = false;
  searchQuery = '';
  private isMouseDownInside = false;
  private searchSubject = new Subject<string>();

  @ViewChild('searchContainer') searchContainerRef!: ElementRef;

  constructor(
    private pokemonService: PokemonService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      document.addEventListener("mouseup", this.handleClickOutside);
    }
    this.loadInitialPokemon();
    this.setupSearchListener();
  }

  ngOnDestroy() {
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener("mouseup", this.handleClickOutside);
    }
  }

  GetPokemonOfficialImage(pokemon: Pokemon){
    return getPokemonOfficialImage(pokemon);
  }

  GetPokemonSpeciesName(PokemonSpecies: PokemonSpecies, language: string){
    return getPokemonSpeciesNameByLanguage(PokemonSpecies, language);
  }

  private loadInitialPokemon() {
    this.pokemonService.getPokemonSpeciesByPrefix("").subscribe({
      next: (response) => {
        this.filteredPokemonSpecies = response.pokemon_v2_pokemonspecies || [];
        this.cdr.detectChanges();
      },
      error: (error) => console.error('Error fetching initial Pokémon:', error),
    });
  }

  private setupSearchListener() {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(searchQuery => 
        searchQuery 
          ? this.pokemonService.getPokemonSpeciesByPrefix(searchQuery) 
          : this.pokemonService.getPokemonSpeciesByPrefix("")
      )
    ).subscribe({
      next: (response) => {
        this.filteredPokemonSpecies = response.pokemon_v2_pokemonspecies || [];
        this.cdr.detectChanges();
      },
      error: (error) => console.error('Error searching Pokémon:', error),
    });
  }

  handleSearchChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery = input.value.trim();
    this.searchSubject.next(this.searchQuery);
  }

  selectPokemon(name: string | undefined) {  
    this.router.navigate(['/pokemon', name]);
  }

  showSearchDropdown() {
    this.showDropdown = true;
    this.cdr.detectChanges();
  }

  handleClickOutside = (event: Event) => {
    if (!this.isMouseDownInside && this.searchContainerRef?.nativeElement &&
        !this.searchContainerRef.nativeElement.contains(event.target)) {
      this.showDropdown = false;
      this.cdr.detectChanges();
    }
    this.isMouseDownInside = false;
  };

  onMouseDownInside() {
    this.isMouseDownInside = true;
  }
}
