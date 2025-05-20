import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, forkJoin, of } from 'rxjs';
import { ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild } from '@angular/core';

import { CommonModule } from '@angular/common';
import { EvolutionService } from '../../../../services/evolution.service';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';
import { MatIcon } from '@angular/material/icon';
import { Name } from '../../../../models/species-name.model';
import { Pokemon } from '../../../../models/pokemon.model';
import { PokemonBgSvgComponent } from '../../../shared/pokemon-bg-svg/pokemon-bg-svg.component';
import { PokemonEvolution } from '../../../../models/pokemon-evolution.model';
import { PokemonEvolutionsComponent } from "../pokemon-evolutions/pokemon-evolutions.component";
import { PokemonNavigatorComponent } from '../pokemon-navigator/pokemon-navigator.component';
import { PokemonService } from '../../../../services/pokemon.service';
import { PokemonSpecies } from '../../../../models/pokemon-species.model';
import { PokemonStatsComponent } from '../pokemon-stats/pokemon-stats.component';
import { PokemonTrainingComponent } from '../pokemon-training/pokemon-training.component';
import { PokemonTypeComponent } from '../../../shared/pokemon-type/pokemon-type.component';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { Sprite } from '../../../../models/sprite.model';
import { Version } from '../../../../models/version.model';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-pokemon-details',
  standalone: true,
  imports: [
    CommonModule,
    PokemonBgSvgComponent,
    PokemonNavigatorComponent,
    LoadingSpinnerComponent,
    PokemonTypeComponent,
    MatIcon,
    PokemonStatsComponent,
    PokemonEvolutionsComponent,
    PokemonTrainingComponent
  ],
  templateUrl: './pokemon-details.component.html',
  styleUrls: ['./pokemon-details.component.css']
})
export class PokemonDetailsComponent implements OnInit {
  @ViewChild('pokemonImage') pokemonImageElement!: ElementRef;
  pokemonSpeciesDetails?: PokemonSpecies;
  pokemonEvolutions: PokemonEvolution[] = [];
  selectedPokemonImage?: string;
  selectedPokemon?: Pokemon;
  isShiny: boolean = false;
  previousPokemonSpecies?: PokemonSpecies;
  nextPokemonSpecies?: PokemonSpecies;
  versions: Version[] = [];
  selectedVersion: Version | null = null;
  private selectedLanguageId$ = new BehaviorSubject<number>(9);
  isMainLoading = true;
  isAdjacentLoading = true;
  isEvolutionsLoading = true;
  get isLoading(): boolean {
    return this.isMainLoading || this.isAdjacentLoading || this.isEvolutionsLoading;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pokemonService: PokemonService,
    private evolutionService: EvolutionService,
    public pokemonUtils: PokemonUtilsService
  ) { }

  ngOnInit() {
    this.subscribeToRouteChanges();
  }

  private subscribeToRouteChanges(): void {
    this.route.paramMap.subscribe(params => {
      this.pokemonSpeciesDetails = undefined;
      this.previousPokemonSpecies = undefined;
      this.nextPokemonSpecies = undefined;
      this.isMainLoading = true;
      this.isAdjacentLoading = true;
      const speciesIdOrName = params.get('speciesIdOrName');
      if (!speciesIdOrName) {
        console.error("No speciesIdOrName found in the route!");
        this.router.navigate(['/']);
        return;
      }
      const isId = /^\d+$/.test(speciesIdOrName);
      if (isId) {
        this.fetchPokemonDetails(parseInt(speciesIdOrName, 10));
      } else {
        this.fetchPokemonDetailsByName(speciesIdOrName);
      }
    });
  }

  fetchPokemonDetails(id: number) {
    this.pokemonService.getPokemonDetails(id, undefined).subscribe({
      next: (response) => {
        this.pokemonSpeciesDetails = response.pokemon_v2_pokemonspecies[0];
        this.isShiny = false;
        this.selectedPokemon = this.pokemonSpeciesDetails?.pokemon_v2_pokemons?.[0];
        this.updateSelectedPokemonImage();
        this.isMainLoading = false;
        if (this.pokemonSpeciesDetails?.id) {
          this.fetchAdjacentPokemon(this.pokemonSpeciesDetails.id);
        } else {
          this.isAdjacentLoading = false;
        }
        this.pokemonSpeciesDetails.pokemon_v2_evolutionchain.pokemon_v2_pokemonspecies.forEach((evolution) => {
          this.fetchPokemonEvolution(evolution.id);
        });
      },
      error: () => this.router.navigate(['/'])
    });
  }

  fetchPokemonDetailsByName(name: string) {
    this.pokemonService.getPokemonDetails(undefined, name).subscribe({
      next: (response) => {
        this.pokemonSpeciesDetails = response.pokemon_v2_pokemonspecies[0];
        this.isShiny = false;
        this.selectedPokemon = this.pokemonSpeciesDetails?.pokemon_v2_pokemons?.[0];
        this.updateSelectedPokemonImage();
        this.isMainLoading = false;
        if (this.pokemonSpeciesDetails?.id) {
          this.fetchAdjacentPokemon(this.pokemonSpeciesDetails.id);
        } else {
          this.isAdjacentLoading = false;
        }
        this.pokemonSpeciesDetails.pokemon_v2_evolutionchain.pokemon_v2_pokemonspecies.forEach((evolution) => {
          this.fetchPokemonEvolution(evolution.id);
        });
      },
      error: () => this.router.navigate(['/'])
    });
  }

  private fetchAdjacentPokemon(currentId: number) {
    const previous$ = currentId > 1
      ? this.pokemonService.getPokemonSpeciesById(currentId - 1).pipe(
        catchError(err => {
          console.error("Error fetching previous Pokémon:", err);
          return of(null);
        })
      )
      : of(null);
    const next$ = this.pokemonService.getPokemonSpeciesById(currentId + 1).pipe(
      catchError(err => {
        console.error("Error fetching next Pokémon:", err);
        return of(null);
      })
    );
    forkJoin([previous$, next$]).subscribe(([prevResponse, nextResponse]) => {
      this.previousPokemonSpecies = prevResponse ? prevResponse.pokemon_v2_pokemonspecies[0] : undefined;
      this.nextPokemonSpecies = nextResponse ? nextResponse.pokemon_v2_pokemonspecies[0] : undefined;
      this.isAdjacentLoading = false;
    });
  }

  fetchPokemonEvolution(id: number) {
    this.pokemonEvolutions = [];
    this.evolutionService.getPokemonEvolution(id).subscribe({
      next: (response) => {
        this.pokemonEvolutions.push(...response.pokemon_v2_pokemonevolution);
        this.isEvolutionsLoading = false;
      },
      error: () => this.router.navigate(['/'])
    });
  }

  onPokemonChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const selectedPokemonId = selectElement.value;
    if (!this.pokemonSpeciesDetails?.pokemon_v2_pokemons) return;
    const selected = this.pokemonSpeciesDetails.pokemon_v2_pokemons.find(
      p => p.id === +selectedPokemonId
    );
    if (selected) {
      this.selectedPokemon = selected;
      this.updateSelectedPokemonImage();
    }
  }

  updateSelectedPokemonImage(): void {
    if (!this.selectedPokemon || !this.selectedPokemon.pokemon_v2_pokemonsprites?.length) {
      this.selectedPokemonImage = undefined;
      return;
    }
    const spritesData = this.selectedPokemon.pokemon_v2_pokemonsprites[0].sprites;
    const officialArtwork = spritesData.other["official-artwork"];
    let spriteKey: keyof Sprite = this.isShiny ? 'front_shiny' : 'front_default';
    this.selectedPokemonImage = officialArtwork[spriteKey] || officialArtwork['front_default'];
  }

  onImageLoad(): void {
    if (this.pokemonImageElement) {
      const el = this.pokemonImageElement.nativeElement;
      el.classList.add('pop');
      setTimeout(() => {
        el.classList.remove('pop');
      }, 300);
    }
  }

  onSpriteTypeChange(isShiny: boolean): void {
    this.isShiny = isShiny;
    this.updateSelectedPokemonImage();
  }

  getPokemonSpeciesName(): string {
    return this.pokemonUtils.getPokemonSpeciesNameByLanguage(this.pokemonSpeciesDetails);
  }

  getPokemonVariantName(pokemon: any): string {
    if (!pokemon?.pokemon_v2_pokemonforms?.length) {
      return pokemon.name;
    }

    const formName = this.pokemonUtils.getNameByLanguage(pokemon.pokemon_v2_pokemonforms[0].pokemon_v2_pokemonformnames);

    return formName === 'Unknown'
      ? this.getPokemonSpeciesName()
      : formName;
  }

  hasMultipleVariants(): boolean {
    return (this.pokemonSpeciesDetails?.pokemon_v2_pokemons?.length || 0) > 1;
  }

  getAbilityText(ability: any, index: number): string {
    const abilityName = this.pokemonUtils.getNameByLanguage(ability.pokemon_v2_ability.pokemon_v2_abilitynames);
    return `${index + 1}. ${abilityName}${ability.is_hidden ? ' (Hidden)' : ''}`;
  }

  getAbilityFlavorText(ability: any): string {
    return this.pokemonUtils.getAbilityFlavorTextByLanguage(ability);
  }

  getGenerationName(generationNames: Name[] | undefined): string {
    return this.pokemonUtils.parseGenerationName(generationNames);
  }

  getPokemonShapeName(shapeNames: Name[] | undefined): string {
    return this.pokemonUtils.getNameByLanguage(shapeNames);
  }

  getPokemonColorName(colorNames: Name[] | undefined): string {
    return this.pokemonUtils.getNameByLanguage(colorNames);
  }

  getFormattedHeight(heightDm: number | undefined): string {
    if (!heightDm) return "Unknown";

    const meters = heightDm / 10;
    const totalInches = meters * 39.37;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);

    return `${meters.toFixed(1)}m (${feet}'${inches}")`;
  }

  getFormattedWeight(weightHg: number | undefined): string {
    if (!weightHg) return "Unknown";

    const kg = weightHg / 10;
    const lbs = kg * 2.20462;

    return `${kg.toFixed(1)}kg (${lbs.toFixed(1)}lbs)`;
  }

  isLegendaryOrMythicalOrBaby(): boolean | undefined {
    return (
      this.pokemonSpeciesDetails?.is_legendary ||
      this.pokemonSpeciesDetails?.is_mythical ||
      this.pokemonSpeciesDetails?.is_baby
    );
  }

  getPokemonStatus(pokemonSpecies: any): string {
    if (pokemonSpecies?.is_mythical) return "Mythical";
    if (pokemonSpecies?.is_legendary) return "Legendary";
    if (pokemonSpecies?.is_baby) return "Baby";
    return "";
  }

  getLegacyCryUrl(): string | null {
    return this.selectedPokemon?.pokemon_v2_pokemoncries?.[0]?.cries?.legacy || null;
  }

  getLatestCryUrl(): string | null {
    return this.selectedPokemon?.pokemon_v2_pokemoncries?.[0]?.cries?.latest || null;
  }

  getPokemonDexEntry(): string {
    return this.pokemonUtils.getPokemonSpeciesDexEntryByVersion(
      this.pokemonSpeciesDetails,
      this.selectedVersion?.id || null
    );
  }

  playCry(version: 'legacy' | 'latest') {
    const cryUrl = version === 'legacy' ? this.getLegacyCryUrl() : this.getLatestCryUrl();

    if (cryUrl) {
      const audio = new Audio(cryUrl);
      audio.volume = 0.05;
      audio.play();
    } else {
      console.error(`No ${version} cry found for this Pokémon.`);
    }
  }
}
