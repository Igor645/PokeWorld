import { AfterViewChecked, Component, ElementRef, HostBinding, Input, OnChanges, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { EvolutionCondition, EvolutionConditionDisplayComponent } from './evolution-condition-display/evolution-condition-display.component';

import { CommonModule } from '@angular/common';
import { EvolutionChain } from '../../../../models/evolution-chain.model';
import { EvolutionTrigger } from '../../../../models/evolution-trigger.model';
import { ExpandableSectionComponent } from '../../../shared/expandable-section/expandable-section.component';
import { Pokemon } from '../../../../models/pokemon.model';
import { PokemonCardComponent } from '../../../shared/pokemon-card/pokemon-card.component';
import { PokemonEvolution } from '../../../../models/pokemon-evolution.model';
import { PokemonSpecies } from '../../../../models/pokemon-species.model';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { RouterModule } from '@angular/router';
import { VersionStateService } from '../../../../services/version-state.service';

const REGIONAL_SUFFIXES = ['alola', 'galar', 'hisui', 'paldea'];

export type EvolutionEntry = { species: PokemonSpecies; form: Pokemon; formIndex: number };

export interface EvoBranch {
  stages: EvolutionEntry[];
}

export interface EvoGroup {
  ancestor: EvolutionEntry;
  sharedStages: EvolutionEntry[];
  branches: EvoBranch[];
}

export interface MegaNode {
  species: PokemonSpecies;
  form: Pokemon;
  baseForm: Pokemon;
  megaType: 'mega' | 'gmax' | 'eternamax';
}


@Component({
  selector: 'app-pokemon-evolutions',
  imports: [
    CommonModule,
    ExpandableSectionComponent,
    EvolutionConditionDisplayComponent,
    PokemonCardComponent,
    RouterModule
  ],
  templateUrl: './pokemon-evolutions.component.html',
  styleUrl: './pokemon-evolutions.component.css'
})
export class PokemonEvolutionsComponent implements OnChanges, OnInit, OnDestroy, AfterViewChecked {
  @Input() evolutionChain: EvolutionChain | undefined = undefined;
  @Input() pokemonEvolutions: PokemonEvolution[] = [];
  @Input() currentSpecies: PokemonSpecies | undefined = undefined;

  evolutionPaths: EvolutionEntry[][] = [];
  evoGroups: EvoGroup[] = [];
  megaFormNodes: MegaNode[] = [];
  isExpanded = true;
  selectedVgId = 0;

  @ViewChildren('evoChain') evoChainRefs!: QueryList<ElementRef<HTMLElement>>;
  private needsCenterScroll = false;
  private destroy$ = new Subject<void>();

  @HostBinding('class.expanded')
  get hostExpanded() { return this.isExpanded; }

  constructor(public pokemonUtils: PokemonUtilsService, private versionState: VersionStateService) { }

  ngOnInit(): void {
    this.versionState.vgId$.pipe(takeUntil(this.destroy$)).subscribe(vgId => {
      this.selectedVgId = vgId;
      if (this.evolutionChain) {
        this.evolutionPaths = this.buildFullEvolutionPaths();
        this.evoGroups = this.buildEvoGroups();
        this.needsCenterScroll = true;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnChanges(): void {
    if (this.evolutionChain) {
      this.evolutionPaths = this.buildFullEvolutionPaths();
      this.evoGroups = this.buildEvoGroups();
      this.megaFormNodes = this.buildMegaFormNodes();
      this.needsCenterScroll = true;
    }
  }

  private versionedEvos(evos: PokemonEvolution[]): PokemonEvolution[] {
    if (!this.selectedVgId) return evos;
    const filtered = evos.filter(e => e.version_group_id == null || e.version_group_id === this.selectedVgId);
    return filtered.length > 0 ? filtered : evos;
  }

  ngAfterViewChecked(): void {
    if (!this.needsCenterScroll || !this.evoChainRefs) return;
    this.needsCenterScroll = false;
    this.evoChainRefs.forEach(ref => {
      const el = ref.nativeElement;
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    });
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
  }

  get isSingleStage(): boolean {
    return this.evolutionPaths.length === 1 && this.evolutionPaths[0].length === 1;
  }

  // ── Display helpers ──────────────────────────────────────────────────────────

  getEvoNodeName(species: PokemonSpecies): string {
    return this.pokemonUtils.getLocalizedNameFromEntity(species, 'pokemonspeciesnames');
  }

  getPokemonOfficialImage(form: Pokemon): string {
    return this.pokemonUtils.getPokemonOfficialImage(form);
  }

  getConnectorEvolutions(entry: EvolutionEntry): PokemonEvolution[] | undefined {
    return this.getPokemonEvolution(entry.species.id, entry.formIndex);
  }

  // ── Group builder ────────────────────────────────────────────────────────────

  buildEvoGroups(): EvoGroup[] {
    const sorted = [...this.evolutionPaths].sort((a, b) => {
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const diff = (a[i]?.form?.id ?? 0) - (b[i]?.form?.id ?? 0);
        if (diff !== 0) return diff;
      }
      return a.length - b.length;
    });

    const groups: EvoGroup[] = [];
    let i = 0;
    while (i < sorted.length) {
      const ancestor = sorted[i][0];
      const rawBranches: EvoBranch[] = [];
      while (i < sorted.length && sorted[i][0].form.id === ancestor.form.id) {
        const remaining = sorted[i].slice(1);
        if (remaining.length > 0) rawBranches.push({ stages: remaining });
        i++;
      }

      // Remove branches that are a strict prefix of a longer branch (e.g. Applin: [Sirapfel] ⊂ [Sirapfel, Hydrapfel])
      const deduped = rawBranches.filter((b, bIdx) =>
        !rawBranches.some((other, oIdx) =>
          oIdx !== bIdx &&
          other.stages.length > b.stages.length &&
          b.stages.every((s, si) => s.form.id === other.stages[si]?.form?.id)
        )
      );

      // Extract common leading stages shared by every branch (e.g. Cyndaquil: Quilava before the Typhlosion split)
      const sharedStages: EvolutionEntry[] = [];
      let branches = deduped;
      while (branches.length > 1 && branches.every(b => b.stages.length > 0)) {
        const firstId = branches[0].stages[0].form.id;
        if (!branches.every(b => b.stages[0]?.form?.id === firstId)) break;
        sharedStages.push(branches[0].stages[0]);
        branches = branches.map(b => ({ stages: b.stages.slice(1) }));
      }

      groups.push({ ancestor, sharedStages, branches: branches.filter(b => b.stages.length > 0) });
    }
    return groups;
  }

  // ── Path building ────────────────────────────────────────────────────────────

  buildFullEvolutionPaths(): EvolutionEntry[][] {
    if (!this.evolutionChain) return [];

    const speciesMap = new Map<number, PokemonSpecies>();
    for (const species of this.evolutionChain.pokemonspecies) {
      speciesMap.set(species.id, species);
    }

    const baseSpeciesPaths: PokemonSpecies[][] = [];
    for (const species of speciesMap.values()) {
      const hasChildren = Array.from(speciesMap.values()).some(
        s => s.evolves_from_species_id === species.id
      );
      if (hasChildren) continue;

      const path: PokemonSpecies[] = [];
      let current: PokemonSpecies | undefined = species;
      while (current) {
        path.unshift(current);
        current = current.evolves_from_species_id
          ? speciesMap.get(current.evolves_from_species_id)
          : undefined;
      }
      baseSpeciesPaths.push(path);
    }

    // Some non-leaf species are dead-ends for their DEFAULT form even though a
    // REGIONAL form can evolve further (e.g. regular Linoone never evolves, but
    // Galarian Linoone → Obstagoon). Detect them: if every full path that passes
    // through the species is inferred as regional, add a sub-path ending there
    // so the default-form branch is shown alongside the regional chain.
    for (const [, species] of speciesMap) {
      const hasChildren = Array.from(speciesMap.values()).some(
        s => s.evolves_from_species_id === species.id
      );
      if (!hasChildren) continue;

      const subPath: PokemonSpecies[] = [];
      let cur: PokemonSpecies | undefined = species;
      while (cur) {
        subPath.unshift(cur);
        cur = cur.evolves_from_species_id
          ? speciesMap.get(cur.evolves_from_species_id)
          : undefined;
      }

      const pathsThroughHere = baseSpeciesPaths.filter(
        p => p.some(s => s.id === species.id) && p[p.length - 1].id !== species.id
      );
      if (pathsThroughHere.length === 0) continue;

      const allRegional = pathsThroughHere.every(
        p => this.inferRegionForPath(p) !== null
      );
      if (allRegional) {
        baseSpeciesPaths.push(subPath);
      }
    }

    const result: EvolutionEntry[][] = [];

    for (const path of baseSpeciesPaths) {
      const leaf = path[path.length - 1];
      const leafVariants = this.getFormVariants(leaf);

      if (leafVariants.length > 0) {
        result.push(path.map(s => ({ species: s, form: this.getDefaultForm(s), formIndex: 0 })));
        leafVariants.forEach((variant, i) => {
          result.push(path.map(s => ({ species: s, form: this.getVariantForm(s, variant), formIndex: i + 1 })));
        });
      } else {
        const inferredRegion = this.inferRegionForPath(path);
        const altForms = this.getNonRegionalFormVariants(leaf);
        const evoCount = this.getUniqueEvolutionCount(leaf.id);

        if (inferredRegion) {
          result.push(path.map(s => ({ species: s, form: this.getVariantForm(s, inferredRegion), formIndex: 0 })));
        } else if (altForms.length > 0 && evoCount > 1) {
          // Species with multiple conditional forms (e.g. Lycanroc midday/midnight/dusk)
          const prefix = path.slice(0, -1).map(s => ({ species: s, form: this.getDefaultForm(s), formIndex: 0 }));
          [undefined, ...altForms].forEach((formName, i) => {
            const leafForm = formName
              ? (leaf.pokemons?.find(p => p.name === formName) ?? this.getDefaultForm(leaf)) as Pokemon
              : this.getDefaultForm(leaf);
            result.push([...prefix, { species: leaf, form: leafForm, formIndex: i }]);
          });
        } else {
          result.push(path.map(s => ({ species: s, form: this.getDefaultForm(s), formIndex: 0 })));
        }
      }
    }

    return result;
  }

  // ── Evolution lookup ─────────────────────────────────────────────────────────

  getPokemonEvolution(id: number, formIndex?: number): PokemonEvolution[] | undefined {
    const all = this.pokemonEvolutions.filter(evo => evo?.evolved_species_id === id);
    const seen = new Set<string>();
    const unique = this.versionedEvos(all).filter(evo => {
      const fp = this.evolutionFingerprint(evo);
      if (seen.has(fp)) return false;
      seen.add(fp);
      return true;
    });
    if (unique.length === 0) return undefined;
    if (formIndex !== undefined && unique.length > 1 && formIndex < unique.length) {
      return [unique[formIndex]];
    }
    return unique;
  }

  getEvolutionTriggerName(evolutionTrigger: EvolutionTrigger): string {
    return this.pokemonUtils.getLocalizedNameFromEntity(evolutionTrigger, 'evolutiontriggernames');
  }

  getEvolutionConditions(evo: PokemonEvolution): EvolutionCondition[] {
    const conditions: EvolutionCondition[] = [];

    if (typeof evo.min_level === 'number') {
      conditions.push({ icon: 'trending_up', entity: `${evo.min_level}` });
    }

    if (evo.time_of_day) {
      const icon = evo.time_of_day === 'night' ? 'dark_mode'
        : evo.time_of_day === 'dusk' ? 'wb_twilight'
        : 'light_mode';
      conditions.push({ icon, entity: evo.time_of_day });
    }

    if (evo.min_happiness != null) {
      conditions.push({ icon: 'favorite', entity: 'friendship' });
    }

    if (evo.min_beauty != null) {
      conditions.push({ icon: 'auto_awesome', entity: 'beauty' });
    }

    if (evo.min_affection != null) {
      conditions.push({ icon: 'favorite_border', entity: 'affection' });
    }

    if (evo.item) {
      const item = evo.item;
      const name = this.pokemonUtils.getLocalizedNameFromEntity(item, 'itemnames');
      const sprite = item.itemsprites?.[0]?.sprites?.default;
      conditions.push({ entity: name, href: `/item/${name}`, spriteUrl: sprite });
    }

    if (evo.ItemByHeldItemId) {
      const item = evo.ItemByHeldItemId;
      const name = this.pokemonUtils.getLocalizedNameFromEntity(item, 'itemnames');
      const sprite = item.itemsprites?.[0]?.sprites?.default;
      conditions.push({ icon: 'back_hand', spriteUrl: sprite, entity: name, href: `/item/${name}` });
    }

    if (evo.gender?.name) {
      const isFemale = evo.gender.name.toLowerCase() === 'female';
      conditions.push({ spriteUrl: isFemale ? '/images/female.png' : '/images/male.png' });
    }

    if (evo.location) {
      const name = this.pokemonUtils.getLocalizedNameFromEntity(evo.location, 'locationnames');
      conditions.push({ icon: 'place', entity: name, href: `/location/${name}` });
    }

    if (evo.move) {
      const name = this.pokemonUtils.getLocalizedNameFromEntity(evo.move, 'movenames');
      conditions.push({ icon: 'bolt', entity: name, href: `/move/${name}` });
    }

    if (evo.type) {
      const name = this.pokemonUtils.getLocalizedNameFromEntity(evo.type, 'typenames');
      conditions.push({ icon: 'bolt', entity: name, suffix: '-type', href: `/type/${name}` });
    }

    if (evo.needs_overworld_rain) {
      conditions.push({ icon: 'water_drop', entity: 'rain' });
    }

    if (evo.turn_upside_down) {
      conditions.push({ icon: 'screen_rotation', entity: 'upside-down' });
    }

    if (evo.PokemonspecyByPartySpeciesId) {
      const name = this.pokemonUtils.getLocalizedNameFromEntity(evo.PokemonspecyByPartySpeciesId, 'pokemonspeciesnames');
      conditions.push({ icon: 'group', entity: name, suffix: ' in party', href: `/pokemon/${name}` });
    }

    if (evo.TypeByPartyTypeId) {
      const name = this.pokemonUtils.getLocalizedNameFromEntity(evo.TypeByPartyTypeId, 'typenames');
      conditions.push({ icon: 'group', entity: name, suffix: '-type in party', href: `/type/${name}` });
    }

    if (evo.PokemonspecyByTradeSpeciesId) {
      const name = this.pokemonUtils.getLocalizedNameFromEntity(evo.PokemonspecyByTradeSpeciesId, 'pokemonspeciesnames');
      conditions.push({ icon: 'swap_horiz', entity: name, href: `/pokemon/${name}` });
    }

    if (typeof evo.relative_physical_stats === 'number') {
      const label = evo.relative_physical_stats === 1 ? 'ATK>DEF'
        : evo.relative_physical_stats === 0 ? 'ATK=DEF'
        : 'ATK<DEF';
      conditions.push({ icon: 'balance', prefix: label });
    }

    if (evo.evolutiontrigger) {
      const slug = evo.evolutiontrigger.name;
      const redundant =
        (slug === 'level-up' && conditions.length > 0) ||
        (slug === 'use-item' && !!evo.item) ||
        (slug === 'trade'    && !!evo.PokemonspecyByTradeSpeciesId);

      if (!redundant) {
        const name = this.getEvolutionTriggerName(evo.evolutiontrigger);
        const icon = slug === 'level-up' ? 'trending_up'
          : slug === 'trade' ? 'swap_horiz'
          : slug === 'shed' ? 'change_circle'
          : undefined;
        if (!conditions.some(c => c.prefix === name || c.entity === name)) {
          conditions.push({ icon, prefix: name });
        }
      }
    }

    if (conditions.length === 0) {
      conditions.push({ prefix: 'No evolutions' });
    }

    return conditions;
  }

  hasConditions(evolutions: PokemonEvolution[]): boolean {
    return evolutions.some(evo => this.getEvolutionConditions(evo)?.length > 0);
  }

  // ── Form helpers ─────────────────────────────────────────────────────────────

  private getNonRegionalFormVariants(species: PokemonSpecies): string[] {
    return (species.pokemons ?? [])
      .filter(p => {
        if (p.is_default) return false;
        const n = p.name;
        if (REGIONAL_SUFFIXES.some(s => n === `${species.name}-${s}`)) return false;
        if (n.includes('-mega') || n.endsWith('-gmax') || n.endsWith('-eternamax')) return false;
        return true;
      })
      .map(p => p.name);
  }

  private getUniqueEvolutionCount(speciesId: number): number {
    const all = this.pokemonEvolutions.filter(e => e?.evolved_species_id === speciesId);
    const seen = new Set<string>();
    return this.versionedEvos(all).filter(e => {
      const fp = this.evolutionFingerprint(e);
      if (seen.has(fp)) return false;
      seen.add(fp);
      return true;
    }).length;
  }

  private getFormVariants(species: PokemonSpecies): string[] {
    return REGIONAL_SUFFIXES.filter(suffix =>
      species.pokemons?.some(p => p.name === `${species.name}-${suffix}`)
    );
  }

  private hasVariantForm(species: PokemonSpecies, variant: string): boolean {
    return species.pokemons?.some(p => p.name === `${species.name}-${variant}`) ?? false;
  }

  private getDefaultForm(species: PokemonSpecies): Pokemon {
    return (species.pokemons?.find(p => p.is_default) ?? species.pokemons?.[0]) as Pokemon;
  }

  private getVariantForm(species: PokemonSpecies, variant: string): Pokemon {
    return (
      species.pokemons?.find(p => p.name === `${species.name}-${variant}`)
      ?? species.pokemons?.find(p => p.is_default)
      ?? species.pokemons?.[0]
    ) as Pokemon;
  }

  private inferRegionForPath(path: PokemonSpecies[]): string | null {
    if (path.length < 2) return null;
    const leaf = path[path.length - 1];
    const genName = leaf.generation?.name ?? '';
    const preEvos = path.slice(0, -1);
    const availableVariants = new Set(
      REGIONAL_SUFFIXES.filter(suffix => preEvos.some(s => this.hasVariantForm(s, suffix)))
    );
    if (genName === 'generation-vii' && availableVariants.has('alola')) return 'alola';
    if (genName === 'generation-viii') {
      if (availableVariants.has('galar')) return 'galar';
      if (availableVariants.has('hisui')) return 'hisui';
    }
    if (genName === 'generation-ix' && availableVariants.has('paldea')) return 'paldea';
    return null;
  }

  // ── Mega / Special form helpers ──────────────────────────────────────────────

  private buildMegaFormNodes(): MegaNode[] {
    if (!this.evolutionChain) return [];
    const nodes: MegaNode[] = [];
    for (const chainSpecies of this.evolutionChain.pokemonspecies) {
      // Use the full species data (with sprites, form names, held items) when available
      const richPokemons = this.currentSpecies?.id === chainSpecies.id
        ? (this.currentSpecies!.pokemons ?? chainSpecies.pokemons)
        : chainSpecies.pokemons;

      const baseForm = richPokemons?.find(p => p.is_default);
      if (!baseForm) continue;

      for (const chainForm of chainSpecies.pokemons ?? []) {
        if (chainForm.is_default) continue;
        const n = chainForm.name;
        let megaType: 'mega' | 'gmax' | 'eternamax' | null = null;
        if (n.endsWith('-eternamax')) megaType = 'eternamax';
        else if (n.endsWith('-gmax')) megaType = 'gmax';
        else if (n.includes('-mega')) megaType = 'mega';
        if (!megaType) continue;

        const richForm = richPokemons?.find(p => p.name === chainForm.name) ?? chainForm;
        nodes.push({ species: chainSpecies, form: richForm, baseForm, megaType });
      }
    }
    return nodes;
  }

getMegaFormDisplayName(node: MegaNode): string {
    const formData = (node.form as any).pokemonforms?.[0];
    if (formData?.pokemonformnames?.length > 0) {
      const name = this.pokemonUtils.getLocalizedNameFromEntity(formData, 'pokemonformnames');
      const slug: string = formData.name ?? '';
      const capitalizedSlug = slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : '';
      if (name && name !== 'Unknown' && name !== capitalizedSlug) return name;
    }
    const speciesName = this.pokemonUtils.getLocalizedNameFromEntity(node.species, 'pokemonspeciesnames');
    if (node.megaType === 'gmax') return `Gigantamax ${speciesName}`;
    if (node.megaType === 'eternamax') return `Eternamax ${speciesName}`;
    const variant = node.form.name.match(/-mega-([xy])$/)?.[1]?.toUpperCase();
    return variant ? `Mega ${speciesName} ${variant}` : `Mega ${speciesName}`;
  }

  getMegaConditions(node: MegaNode): EvolutionCondition[] {
    const icon = node.megaType === 'gmax' ? 'aspect_ratio'
      : node.megaType === 'eternamax' ? 'all_inclusive'
      : 'auto_awesome';
    const label = node.megaType === 'gmax' ? 'Gigantamax'
      : node.megaType === 'eternamax' ? 'Eternamax'
      : 'Mega Evolution';
    return [{ prefix: label, icon }];
  }

  private evolutionFingerprint(evo: PokemonEvolution): string {
    return JSON.stringify({
      trigger: evo.evolutiontrigger?.name,
      level: evo.min_level,
      item: evo.item?.name,
      heldItem: evo.ItemByHeldItemId?.name,
      location: evo.location?.id,
      move: evo.move?.id,
      happiness: evo.min_happiness,
      beauty: evo.min_beauty,
      affection: evo.min_affection,
      time: evo.time_of_day,
      gender: evo.gender?.name,
      rain: evo.needs_overworld_rain,
      upsideDown: evo.turn_upside_down,
      partySpecies: evo.PokemonspecyByPartySpeciesId?.id,
      partyType: (evo.TypeByPartyTypeId as any)?.name,
      tradeSpecies: evo.PokemonspecyByTradeSpeciesId?.id,
      relStats: evo.relative_physical_stats,
      knownMoveType: (evo.type as any)?.id,
    });
  }
}
