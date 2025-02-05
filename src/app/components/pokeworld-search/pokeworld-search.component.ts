import { 
  Component, Inject, PLATFORM_ID, ElementRef, ViewChild, ChangeDetectorRef, AfterViewInit, OnDestroy 
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PokemonService } from '../../services/pokemon.service';
import { PokemonSpecies } from '../../models/pokemon-species.model';
import { Name } from '../../models/species-name.model';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import {getPokemonOfficialImage, getPokemonSpeciesNameByLanguage} from '../../utils/pokemon-utils';
import { Pokemon } from '../../models/pokemon.model';
import { PokeworldSearchItemComponent } from '../pokeworld-search-item/pokeworld-search-item.component';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { HostListener } from '@angular/core';

@Component({
  selector: 'app-pokeworld-search',
  standalone: true,
  imports: [CommonModule, PokeworldSearchItemComponent],
  templateUrl: './pokeworld-search.component.html',
  styleUrls: ['./pokeworld-search.component.css'],
  animations: [
    trigger('slideDropdown', [
      state('void', style({ transform: 'translateY(-10%)', opacity: 0 })),
      state('*', style({ transform: 'translateY(0)', opacity: 1 })),
      transition(':enter', [animate('0.3s ease-out')]),
      transition(':leave', [animate('0.2s ease-in', style({ transform: 'translateY(-10%)', opacity: 0 }))])
    ])
  ]
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
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngAfterViewInit() {
    this.loadInitialPokemon();
    this.setupSearchListener();
  }

  ngOnDestroy() {
    this.searchSubject.complete();
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
  

  handleSearchChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery = input.value.trim();
  
    this.searchSubject.next(this.searchQuery);
    this.showDropdown = true;
    this.cdr.markForCheck();
  }
  

  showSearchDropdown() {
    this.showDropdown = true;
    this.cdr.detectChanges();
  }

  @HostListener('document:mousedown', ['$event'])
  handleMouseDownOutside(event: Event) {
    if (
      this.searchContainerRef &&
      this.searchContainerRef.nativeElement.contains(event.target)
    ) {
      return;
    }
    
    this.showDropdown = false;
    this.cdr.detectChanges();
  }

  @HostListener('window:blur')
  handleWindowBlur() {
    this.showDropdown = false;
    this.cdr.detectChanges();
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

  trackByPokemon(index: number, item: PokemonSpecies): number {
    return item.id;
  }
}
