import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, map, startWith, switchMap, takeUntil, tap } from 'rxjs/operators';

import { CommonModule } from '@angular/common';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Name } from '../../../models/name.model';
import { PokemonService } from '../../../services/pokemon.service';
import { PokemonSpecies } from '../../../models/pokemon-species.model';
import { PokemonUtilsService } from '../../../utils/pokemon-utils';
import { PokeworldSearchItemComponent } from '../pokeworld-search-item/pokeworld-search-item.component';

@Component({
  selector: 'app-pokeworld-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatAutocompleteModule, MatFormFieldModule, MatInputModule, PokeworldSearchItemComponent],
  templateUrl: './pokeworld-search.component.html',
  styleUrls: ['./pokeworld-search.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PokeworldSearchComponent implements AfterViewInit, OnDestroy {
  searchControl = new FormControl<string>('', { nonNullable: true });
  filteredPokemonSpecies: PokemonSpecies[] = [];
  private routeSubscription!: Subscription;
  private destroy$ = new Subject<void>();
  isLoading = false;

  constructor(
    private pokemonService: PokemonService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private pokemonUtils: PokemonUtilsService
  ) { }

  ngAfterViewInit() {
    this.routeSubscription = this.router.events
      .pipe(takeUntil(this.destroy$), filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.clearSearch());

    this.searchControl.valueChanges.pipe(
      startWith(this.searchControl.value),
      map(v => (v ?? '').toString().trim().toLowerCase()),
      distinctUntilChanged(),
      debounceTime(250),
      tap(() => { this.isLoading = true; this.cdr.markForCheck(); }),
      switchMap(q => this.pokemonService.getPokemonSpeciesByPrefix(q)),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        const speciesList = response?.pokemonspecies ?? [];
        this.filteredPokemonSpecies = speciesList;
        this.isLoading = false;
        this.cdr.markForCheck();

        queueMicrotask(() => {
          for (const s of speciesList) {
            const p = s.pokemons?.[0];
            const url = p ? this.getPokemonOfficialImage(p) : '';
            if (url) this.preloadImage(url);
          }
        });
      },
      error: (err) => {
        console.error('Error searching Pokémon:', err);
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.routeSubscription) this.routeSubscription.unsubscribe();
  }

  clearSearch() {
    if (this.searchControl.value !== '') {
      this.searchControl.setValue('', { emitEvent: true });
    }
  }

  onOptionSelected(event: any) {
    const selectedItem = event.option.value;
    if (!selectedItem) return;
    if ('pokemonspeciesnames' in selectedItem) {
      this.router.navigate(['/pokemon', this.getPokemonName(selectedItem)]);
    } else {
      console.warn('Unknown selection type:', selectedItem);
    }
  }

  getPokemonName(species: PokemonSpecies): string {
    return this.pokemonUtils.getLocalizedNameFromEntity(species, 'pokemonspeciesnames');
  }

  getPokemonOfficialImage(pokemon: any) {
    return this.pokemonUtils.getPokemonOfficialImage(pokemon);
  }

  trackByPokemon = (_: number, item: PokemonSpecies) => item.id;

  GetPokemonOfficialImage(pokemon: any) {
    return this.getPokemonOfficialImage(pokemon);
  }

  private preloadImage(url: string): void {
    if (typeof window === 'undefined' || !url) return;
    const img = new Image();
    img.src = url;
  }
}
