import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, forkJoin, of } from 'rxjs';
import { ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { PokemonSpecies, PokemonSpeciesResponse } from '../../../../models/pokemon-species.model';

import { CommonModule } from '@angular/common';
import { EvolutionService } from '../../../../services/evolution.service';
import { Generation } from '../../../../models/generation.model';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';
import { MatIcon } from '@angular/material/icon';
import { Name } from '../../../../models/name.model';
import { Pokemon } from '../../../../models/pokemon.model';
import { PokemonBgSvgComponent } from '../../../shared/pokemon-bg-svg/pokemon-bg-svg.component';
import { PokemonBreedingComponent } from '../pokemon-breeding/pokemon-breeding.component';
import { PokemonColor } from '../../../../models/pokemon-color.model';
import { PokemonEvolution } from '../../../../models/pokemon-evolution.model';
import { PokemonEvolutionsComponent } from "../pokemon-evolutions/pokemon-evolutions.component";
import { PokemonFormsComponent } from '../pokemon-forms/pokemon-forms.component';
import { PokemonMovesComponent } from '../pokemon-moves/pokemon-moves.component';
import { PokemonNavigatorComponent } from '../pokemon-navigator/pokemon-navigator.component';
import { PokemonRelationsComponent } from '../pokemon-relations/pokemon-relations.component';
import { PokemonService } from '../../../../services/pokemon.service';
import { PokemonShape } from '../../../../models/pokemon-shape.model';
import { PokemonStatsComponent } from '../pokemon-stats/pokemon-stats.component';
import { PokemonTrainingComponent } from '../pokemon-training/pokemon-training.component';
import { PokemonType } from '../../../../models/pokemon-type.model';
import { PokemonTypeComponent } from '../../../shared/pokemon-type/pokemon-type.component';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { Sprite } from '../../../../models/sprite.model';
import { Type } from '../../../../models/type.model';
import { TypeService } from '../../../../services/type.service';
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
    PokemonTrainingComponent,
    PokemonBreedingComponent,
    PokemonRelationsComponent,
    PokemonFormsComponent,
    PokemonMovesComponent
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
  allTypes: Type[] = [];
  private selectedLanguageId$ = new BehaviorSubject<number>(9);
  isTypesLoading = true;
  isMainLoading = true;
  isAdjacentLoading = true;
  isEvolutionsLoading = true;
  get isLoading(): boolean {
    return this.isMainLoading || this.isAdjacentLoading || this.isEvolutionsLoading || this.isTypesLoading;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pokemonService: PokemonService,
    private typeService: TypeService,
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
    this.fetchPokemonDetailsInternal(id);
  }

  fetchPokemonDetailsByName(name: string) {
    this.fetchPokemonDetailsInternal(undefined, name);
  }

  private fetchPokemonDetailsInternal(id?: number, name?: string) {
    this.pokemonService.getPokemonDetails(id, name).subscribe({
      next: (response) => {
        this.handleSpeciesResponse(response);
      },
      error: () => this.router.navigate(['/'])
    });
  }

  handleSpeciesResponse(response: PokemonSpeciesResponse) {
    this.pokemonSpeciesDetails = response.pokemonspecies[0];
    if (!this.pokemonSpeciesDetails) {
      return;
    }

    this.isShiny = false;
    this.selectedPokemon = this.pokemonSpeciesDetails?.pokemons?.[0];
    this.updateSelectedPokemonImage();
    this.isMainLoading = false;
    this.fetchAllTypes();
    this.fetchAdjacentPokemon(this.pokemonSpeciesDetails.id);
    this.pokemonSpeciesDetails.evolutionchain.pokemonspecies.forEach((evolution) => {
      this.fetchPokemonEvolution(evolution.id);
    });
  }

  fetchAllTypes(): void {
    this.isTypesLoading = true;

    this.typeService.getAllTypes().subscribe({
      next: (result) => {
        this.allTypes = result.type;
        this.isTypesLoading = false;
      },
      error: (err) => {
        console.error('Failed to fetch all types', err);
        this.allTypes = [];
        this.isTypesLoading = false;
      }
    });
  }

  private fetchAdjacentPokemon(currentId: number | undefined): void {
    if (!currentId) {
      this.isAdjacentLoading = false;
      return;
    }

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
      this.previousPokemonSpecies = prevResponse?.pokemonspecies?.[0];
      this.nextPokemonSpecies = nextResponse?.pokemonspecies?.[0];
      this.isAdjacentLoading = false;
    });
  }

  fetchPokemonEvolution(id: number) {
    this.pokemonEvolutions = [];
    this.evolutionService.getPokemonEvolution(id).subscribe({
      next: (response) => {
        this.pokemonEvolutions.push(...response.pokemonevolution);
        this.isEvolutionsLoading = false;
      },
      error: () => this.router.navigate(['/'])
    });
  }

  onPokemonChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const selectedPokemonId = selectElement.value;
    if (!this.pokemonSpeciesDetails?.pokemons) return;
    const selected = this.pokemonSpeciesDetails.pokemons.find(
      p => p.id === +selectedPokemonId
    );
    if (selected) {
      this.selectedPokemon = selected;
      this.updateSelectedPokemonImage();
    }
  }

  updateSelectedPokemonImage(): void {
    if (!this.selectedPokemon || !this.selectedPokemon.pokemonsprites?.length) {
      this.selectedPokemonImage = undefined;
      return;
    }
    const spritesData = this.selectedPokemon.pokemonsprites[0].sprites;
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
    return this.pokemonUtils.getLocalizedNameFromEntity(this.pokemonSpeciesDetails, "pokemonspeciesnames");
  }

  getPokemonVariantName(pokemon: any): string {
    if (!pokemon?.pokemonforms?.length || !this.hasMultipleVariants()) {
      return this.pokemonUtils.getLocalizedNameFromEntity(this.pokemonSpeciesDetails, "pokemonspeciesnames");
    }

    const formName = this.pokemonUtils.getLocalizedNameFromEntity(pokemon.pokemonforms[0], "pokemonformnames");

    return formName === 'Unknown'
      ? this.getPokemonSpeciesName()
      : formName;
  }

  hasMultipleVariants(): boolean {
    return (this.pokemonSpeciesDetails?.pokemons?.length || 0) > 1;
  }

  getAbilityText(ability: any, index: number): string {
    const abilityName = this.pokemonUtils.getLocalizedNameFromEntity(ability.ability, "abilitynames");
    return `${index + 1}. ${abilityName}${ability.is_hidden ? ' (Hidden)' : ''}`;
  }

  getAbilityFlavorText(ability: any): string {
    return this.pokemonUtils.getLocalizedFlavorTextFromEntity(ability, 'abilityflavortexts');
  }

  getGenerationName(generation: Generation | undefined): string {
    return this.pokemonUtils.getLocalizedNameFromEntity(generation, "generationnames");
  }

  getPokemonShapeName(shape: PokemonShape | undefined): string {
    return this.pokemonUtils.getLocalizedNameFromEntity(shape, "pokemonshapenames");
  }

  getPokemonColorName(color: PokemonColor | undefined): string {
    return this.pokemonUtils.getLocalizedNameFromEntity(color, "pokemoncolornames");
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
    return this.selectedPokemon?.pokemoncries?.[0]?.cries?.legacy || null;
  }

  getLatestCryUrl(): string | null {
    return this.selectedPokemon?.pokemoncries?.[0]?.cries?.latest || null;
  }

  getPokemonDexEntry(): string {
    return this.pokemonUtils.getLocalizedFlavorTextFromEntity(
      this.pokemonSpeciesDetails,
      'pokemonspeciesflavortexts',
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
