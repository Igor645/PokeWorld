import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, ViewChild, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { asyncScheduler, combineLatest, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, map, observeOn, switchMap, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { PokemonService } from '../../../services/pokemon.service';
import { PokemonSpecies } from '../../../models/pokemon-species.model';
import { PokemonUtilsService } from '../../../utils/pokemon-utils';
import { PokeworldSearchItemComponent } from '../pokeworld-search-item/pokeworld-search-item.component';
import { ItemService } from '../../../services/item.service';

@Component({
  selector: 'app-pokeworld-search',
  standalone: true,
  imports: [ReactiveFormsModule, MatAutocompleteModule, MatFormFieldModule, MatInputModule, PokeworldSearchItemComponent],
  templateUrl: './pokeworld-search.component.html',
  styleUrls: ['./pokeworld-search.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PokeworldSearchComponent implements AfterViewInit {
  @ViewChild('searchInput') private searchInputEl?: ElementRef<HTMLInputElement>;
  @ViewChild(MatAutocompleteTrigger) private autoTrigger?: MatAutocompleteTrigger;

  searchControl = new FormControl<string>('', { nonNullable: true });
  filteredPokemonSpecies: PokemonSpecies[] = [];
  filteredItems: any[] = [];
  isLoading = false;
  private isProgrammaticFocus = false;
  private destroyRef = inject(DestroyRef);

  focusInput(): void {
    this.isProgrammaticFocus = true;
    setTimeout(() => {
      this.searchInputEl?.nativeElement?.focus();
      setTimeout(() => { this.isProgrammaticFocus = false; }, 0);
    }, 180);
  }

  onFocus(): void {
    if (this.isProgrammaticFocus) return;
    if (!this.searchControl.value && !this.filteredPokemonSpecies.length) {
      this.fetchDefaults();
    }
  }

  private fetchDefaults(): void {
    this.isLoading = true;
    this.cdr.detectChanges();
    combineLatest([
      this.pokemonService.getPokemonSpeciesByPrefix('').pipe(catchError(() => of(null))),
      this.itemService.getItemsByPrefix('').pipe(catchError(() => of(null))),
    ]).pipe(observeOn(asyncScheduler), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ([pokemonRes, itemRes]) => {
        this.filteredPokemonSpecies = pokemonRes?.pokemonspecies ?? [];
        this.filteredItems = itemRes?.item ?? [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isLoading = false; this.cdr.detectChanges(); }
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab' && this.autoTrigger?.panelOpen) {
      const active = this.autoTrigger.activeOption;
      if (active) {
        event.preventDefault();
        (active as any)._selectViaInteraction();
      }
    }
  }

  constructor(
    private pokemonService: PokemonService,
    private itemService: ItemService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private pokemonUtils: PokemonUtilsService
  ) { }

  ngAfterViewInit() {
    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef), filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.clearSearch());

    this.searchControl.valueChanges.pipe(
      map(v => (v ?? '').toString().trim().toLowerCase()),
      distinctUntilChanged(),
      tap(q => { if (!q) this.fetchDefaults(); }),
      filter(q => q.length > 0),
      debounceTime(250),
      tap(() => { this.isLoading = true; this.cdr.detectChanges(); }),
      switchMap(q => combineLatest([
        this.pokemonService.getPokemonSpeciesByPrefix(q).pipe(catchError(() => of(null))),
        this.itemService.getItemsByPrefix(q).pipe(catchError(() => of(null))),
      ]).pipe(observeOn(asyncScheduler))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: ([pokemonRes, itemRes]) => {
        const speciesList = pokemonRes?.pokemonspecies ?? [];
        this.filteredPokemonSpecies = speciesList;
        this.filteredItems = itemRes?.item ?? [];
        this.isLoading = false;
        this.cdr.detectChanges();

        queueMicrotask(() => {
          for (const s of speciesList) {
            const p = s.pokemons?.[0];
            const url = p ? this.getPokemonOfficialImage(p) : '';
            if (url) this.preloadImage(url);
          }
        });
      },
      error: (err) => {
        console.error('Error searching:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  clearSearch() {
    this.filteredPokemonSpecies = [];
    this.filteredItems = [];
    this.isLoading = false;
    if (this.searchControl.value !== '') {
      this.searchControl.setValue('', { emitEvent: false });
    }
    this.cdr.detectChanges();
  }

  onOptionSelected(event: any) {
    const selectedItem = event.option.value;
    if (!selectedItem) return;
    if ('pokemonspeciesnames' in selectedItem) {
      this.router.navigate(['/pokemon', this.getPokemonName(selectedItem)]);
    } else if ('itemnames' in selectedItem) {
      this.router.navigate(['/item', selectedItem.name]);
    }
  }

  getPokemonName(species: PokemonSpecies): string {
    return this.pokemonUtils.getLocalizedNameFromEntity(species, 'pokemonspeciesnames');
  }

  getItemName(item: any): string {
    return this.pokemonUtils.getLocalizedNameFromEntity(item, 'itemnames');
  }

  getItemSprite(item: any): string {
    return item?.itemsprites?.[0]?.sprites?.default ?? '';
  }

  getPokemonOfficialImage(pokemon: any) {
    return this.pokemonUtils.getPokemonOfficialImage(pokemon);
  }

  trackByPokemon = (_: number, item: PokemonSpecies) => item.id;
  trackByItem = (_: number, item: any) => item.id;

  private preloadImage(url: string): void {
    if (typeof window === 'undefined' || !url) return;
    const img = new Image();
    img.src = url;
  }
}
