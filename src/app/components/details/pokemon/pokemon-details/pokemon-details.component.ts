import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PokemonSpecies, PokemonSpeciesResponse } from '../../../../models/pokemon-species.model';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EvolutionService } from '../../../../services/evolution.service';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';
import { MatIcon } from '@angular/material/icon';
import { Pokemon } from '../../../../models/pokemon.model';
import { PokemonBgSvgComponent } from '../../../shared/pokemon-bg-svg/pokemon-bg-svg.component';
import { PokemonBreedingComponent } from '../pokemon-breeding/pokemon-breeding.component';
import { PokemonEvolution } from '../../../../models/pokemon-evolution.model';
import { PokemonEvolutionsComponent } from "../pokemon-evolutions/pokemon-evolutions.component";
import { PokemonFormsComponent } from '../pokemon-forms/pokemon-forms.component';
import { PokemonMovesComponent } from '../pokemon-moves/pokemon-moves.component';
import { PokemonNavigatorComponent } from '../pokemon-navigator/pokemon-navigator.component';
import { PokemonRelationsComponent } from '../pokemon-relations/pokemon-relations.component';
import { PokemonService } from '../../../../services/pokemon.service';
import { PokemonStatsComponent } from '../pokemon-stats/pokemon-stats.component';
import { PokemonTrainingComponent } from '../pokemon-training/pokemon-training.component';
import { PokemonTypeComponent } from '../../../shared/pokemon-type/pokemon-type.component';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { RecentlyViewedService } from '../../../../services/recently-viewed.service';
import { SettingsService } from '../../../../services/settings.service';
import { Sprite } from '../../../../models/sprite.model';
import { Type } from '../../../../models/type.model';
import { TypeService } from '../../../../services/type.service';
import { IndividualVersion, VgOption, VersionStateService } from '../../../../services/version-state.service';
import { PokemonType } from '../../../../models/pokemon-type.model';
import { catchError } from 'rxjs/operators';

interface DetailsVm {
  speciesName: string;
  status: string;
  isSpecial: boolean;
  dexEntry: string;
  generationName: string;
  formattedHeight: string;
  formattedWeight: string;
  shapeName: string;
  colorName: string;
  hasMultipleVariants: boolean;
  variants: { id: number; name: string }[];
  abilities: { text: string; flavorText: string }[];
  latestCryUrl: string | null;
  legacyCryUrl: string | null;
}

const EMPTY_VM: DetailsVm = {
  speciesName: '', status: '', isSpecial: false, dexEntry: '',
  generationName: '', formattedHeight: 'Unknown', formattedWeight: 'Unknown',
  shapeName: '', colorName: '', hasMultipleVariants: false,
  variants: [], abilities: [], latestCryUrl: null, legacyCryUrl: null,
};

@Component({
  selector: 'app-pokemon-details',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
  vgOptions: VgOption[] = [];
  selectedVersionId = 0;
  displayedTypes: PokemonType[] = [];
  groupedVersionOptions: { generationName: string; generationId: number; versions: IndividualVersion[] }[] = [];
  allTypes: Type[] = [];
  isTypesLoading = true;
  isMainLoading = true;
  isAdjacentLoading = true;
  isEvolutionsLoading = true;

  vm: DetailsVm = { ...EMPTY_VM };

  private readonly destroyRef = inject(DestroyRef);

  get isLoading(): boolean {
    return this.isMainLoading || this.isAdjacentLoading || this.isEvolutionsLoading || this.isTypesLoading;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pokemonService: PokemonService,
    private typeService: TypeService,
    private evolutionService: EvolutionService,
    private settingsService: SettingsService,
    private recentlyViewedService: RecentlyViewedService,
    public pokemonUtils: PokemonUtilsService,
    private versionState: VersionStateService,
  ) { }

  ngOnInit() {
    this.subscribeToRouteChanges();
    this.settingsService.watchSetting<number>('selectedLanguageId')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.rebuildVm());
    this.settingsService.watchSetting<string>('spriteStyle')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateSelectedPokemonImage());
    this.versionState.vgOptions$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(opts => {
        this.vgOptions = opts;
        this.groupedVersionOptions = this.buildGroupedVersions(opts);
      });
    this.versionState.versionId$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(id => {
        this.selectedVersionId = id;
        this.rebuildVm();
      });
  }

  private getGenerationIdForVersion(versionId: number): number {
    for (const vg of this.vgOptions) {
      const v = vg.versions.find(x => x.versionId === versionId);
      if (v) return v.generationId;
    }
    // Fall back to vgOptions directly if individual versions aren't populated
    return this.vgOptions.find(vg => vg.versions.some(v => v.versionId === versionId))?.generationId ?? 0;
  }

  private computeDisplayedTypes(pk: Pokemon | undefined): PokemonType[] {
    if (!pk) return [];
    const pastTypes = pk.pokemontypepasts ?? [];
    if (!pastTypes.length) return pk.pokemontypes ?? [];

    const genId = this.getGenerationIdForVersion(this.selectedVersionId);
    if (!genId) return pk.pokemontypes ?? [];

    // Sort unique past-type generation IDs ascending
    const ptGenIds = [...new Set(pastTypes.map(pt => pt.generation_id))].sort((a, b) => a - b);

    // Find the first past-type generation that is >= selectedGenerationId
    // e.g. Magneton: ptGenIds = [1], genId=1 → use past types (Electric only)
    //              genId=2 → none match (1 < 2) → use current types (Electric/Steel)
    const matchGen = ptGenIds.find(g => genId <= g);
    if (matchGen !== undefined) {
      return pastTypes
        .filter(pt => pt.generation_id === matchGen)
        .sort((a, b) => a.slot - b.slot)
        .map(pt => ({ type: pt.type }));
    }
    return pk.pokemontypes ?? [];
  }

  private rebuildVm(): void {
    const sp = this.pokemonSpeciesDetails;
    const pk = this.selectedPokemon;
    if (!sp) return;

    this.displayedTypes = this.computeDisplayedTypes(pk);

    const hasMultiple = (sp.pokemons?.length ?? 0) > 1;

    this.vm = {
      speciesName: this.pokemonUtils.getLocalizedNameFromEntity(sp, 'pokemonspeciesnames'),
      status: sp.is_mythical ? 'Mythical' : sp.is_legendary ? 'Legendary' : sp.is_baby ? 'Baby' : '',
      isSpecial: !!(sp.is_legendary || sp.is_mythical || sp.is_baby),
      dexEntry: this.pokemonUtils.getLocalizedFlavorTextFromEntity(sp, 'pokemonspeciesflavortexts', this.selectedVersionId || null),
      generationName: this.pokemonUtils.getLocalizedNameFromEntity(sp.generation, 'generationnames'),
      formattedHeight: this.formatHeight(pk?.height),
      formattedWeight: this.formatWeight(pk?.weight),
      shapeName: this.pokemonUtils.getLocalizedNameFromEntity(sp.pokemonshape, 'pokemonshapenames'),
      colorName: this.pokemonUtils.getLocalizedNameFromEntity(sp.pokemoncolor, 'pokemoncolornames'),
      hasMultipleVariants: hasMultiple,
      variants: (sp.pokemons ?? []).map(p => ({
        id: p.id,
        name: this.resolveVariantName(p, sp, hasMultiple),
      })),
      abilities: (pk?.pokemonabilities ?? []).map((ability, i) => ({
        text: `${i + 1}. ${this.pokemonUtils.getLocalizedNameFromEntity(ability.ability, 'abilitynames')}${ability.is_hidden ? ' (Hidden)' : ''}`,
        flavorText: this.pokemonUtils.getLocalizedFlavorTextFromEntity(ability.ability, 'abilityflavortexts'),
      })),
      latestCryUrl: pk?.pokemoncries?.[0]?.cries?.latest || null,
      legacyCryUrl: pk?.pokemoncries?.[0]?.cries?.legacy || null,
    };
  }

  private resolveVariantName(pokemon: Pokemon, species: PokemonSpecies, hasMultiple: boolean): string {
    const speciesName = this.pokemonUtils.getLocalizedNameFromEntity(species, 'pokemonspeciesnames');
    if (!hasMultiple || !pokemon.pokemonforms?.length) return speciesName;
    const formName = this.pokemonUtils.getLocalizedNameFromEntity(pokemon.pokemonforms[0], 'pokemonformnames');
    return formName === 'Unknown' ? speciesName : formName;
  }

  onVersionChange(event: Event): void {
    this.versionState.selectVersion(Number((event.target as HTMLSelectElement).value));
  }

  private buildGroupedVersions(opts: VgOption[]): { generationName: string; generationId: number; versions: IndividualVersion[] }[] {
    const genMap = new Map<number, { generationName: string; generationId: number; versions: IndividualVersion[] }>();
    for (const vg of opts) {
      for (const v of vg.versions) {
        let gen = genMap.get(v.generationId);
        if (!gen) genMap.set(v.generationId, gen = { generationName: v.generationName, generationId: v.generationId, versions: [] });
        gen.versions.push(v);
      }
    }
    return Array.from(genMap.values()).sort((a, b) => b.generationId - a.generationId);
  }


  private subscribeToRouteChanges(): void {
    this.route.paramMap.subscribe(params => {
      this.versionState.reset();
      this.pokemonSpeciesDetails = undefined;
      this.previousPokemonSpecies = undefined;
      this.nextPokemonSpecies = undefined;
      this.vm = { ...EMPTY_VM };
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
      next: (response) => this.handleSpeciesResponse(response),
      error: () => this.router.navigate(['/'])
    });
  }

  handleSpeciesResponse(response: PokemonSpeciesResponse) {
    this.pokemonSpeciesDetails = response.pokemonspecies[0];
    if (!this.pokemonSpeciesDetails) return;

    this.isShiny = false;
    this.selectedPokemon = this.pokemonSpeciesDetails?.pokemons?.[0];
    this.updateSelectedPokemonImage();
    this.rebuildVm();

    this.recentlyViewedService.add({
      id: this.pokemonSpeciesDetails.id,
      name: this.pokemonSpeciesDetails.name,
      displayName: this.vm.speciesName || this.pokemonSpeciesDetails.name,
      spriteUrl: this.selectedPokemon?.pokemonsprites?.[0]?.sprites?.front_default ?? null,
    });

    this.isMainLoading = false;
    this.fetchAllTypes();
    this.fetchAdjacentPokemon(this.pokemonSpeciesDetails.id);
    const speciesIds = this.pokemonSpeciesDetails.evolutionchain.pokemonspecies.map(e => e.id);
    this.fetchEvolutions(speciesIds);
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

  private fetchEvolutions(ids: number[]): void {
    this.pokemonEvolutions = [];
    this.isEvolutionsLoading = true;
    this.evolutionService.getPokemonEvolutionsByIds(ids).subscribe({
      next: (response) => {
        this.pokemonEvolutions = response.pokemonevolution;
        this.isEvolutionsLoading = false;
      },
      error: () => this.router.navigate(['/'])
    });
  }

  trackVariantById(_: number, v: { id: number; name: string }): number {
    return v.id;
  }

  onPokemonChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const selectedPokemonId = selectElement.value;
    if (!this.pokemonSpeciesDetails?.pokemons) return;
    const selected = this.pokemonSpeciesDetails.pokemons.find(p => p.id === +selectedPokemonId);
    if (selected) {
      this.selectedPokemon = selected;
      this.updateSelectedPokemonImage();
      this.rebuildVm();
    }
  }

  updateSelectedPokemonImage(): void {
    if (!this.selectedPokemon || !this.selectedPokemon.pokemonsprites?.length) {
      this.selectedPokemonImage = undefined;
      return;
    }
    const spritesData = this.selectedPokemon.pokemonsprites[0].sprites;
    const spriteKey: keyof Sprite = this.isShiny ? 'front_shiny' : 'front_default';
    const style = this.settingsService.getSetting<string>('spriteStyle');
    const home = spritesData.other?.home;
    const artwork = spritesData.other?.['official-artwork'];
    if (style === 'home') {
      this.selectedPokemonImage = home?.[spriteKey] || home?.['front_default'] || artwork?.[spriteKey] || artwork?.['front_default'];
    } else if (style === 'pixel') {
      this.selectedPokemonImage = spritesData[spriteKey] || spritesData['front_default'] || artwork?.['front_default'];
    } else {
      this.selectedPokemonImage = artwork?.[spriteKey] || artwork?.['front_default'] || home?.[spriteKey] || home?.['front_default'];
    }
  }

  onImageLoad(): void {
    if (this.pokemonImageElement) {
      const el = this.pokemonImageElement.nativeElement;
      el.classList.add('pop');
      setTimeout(() => el.classList.remove('pop'), 300);
    }
  }

  onSpriteTypeChange(isShiny: boolean): void {
    this.isShiny = isShiny;
    this.updateSelectedPokemonImage();
  }

  playCry(version: 'legacy' | 'latest') {
    const cryUrl = version === 'legacy' ? this.vm.legacyCryUrl : this.vm.latestCryUrl;
    if (cryUrl) {
      const audio = new Audio(cryUrl);
      audio.volume = 0.05;
      audio.play();
    }
  }

  private formatHeight(heightDm: number | undefined): string {
    if (!heightDm) return 'Unknown';
    const meters = heightDm / 10;
    const totalInches = meters * 39.37;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return `${meters.toFixed(1)}m (${feet}'${inches}")`;
  }

  private formatWeight(weightHg: number | undefined): string {
    if (!weightHg) return 'Unknown';
    const kg = weightHg / 10;
    const lbs = kg * 2.20462;
    return `${kg.toFixed(1)}kg (${lbs.toFixed(1)}lbs)`;
  }
}
