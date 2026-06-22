import { AfterViewChecked, Component, ElementRef, HostBinding, Input, OnChanges, QueryList, ViewChildren } from '@angular/core';
import { EvolutionCondition, EvolutionConditionDisplayComponent } from './evolution-condition-display/evolution-condition-display.component';

import { CommonModule } from '@angular/common';
import { EvolutionChain } from '../../../../models/evolution-chain.model';
import { EvolutionTrigger } from '../../../../models/evolution-trigger.model';
import { ExpandableSectionComponent } from '../../../shared/expandable-section/expandable-section.component';
import { Item } from '../../../../models/item.model';
import { Pokemon } from '../../../../models/pokemon.model';
import { PokemonCardComponent } from '../../../shared/pokemon-card/pokemon-card.component';
import { PokemonEvolution } from '../../../../models/pokemon-evolution.model';
import { PokemonSpecies } from '../../../../models/pokemon-species.model';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { RouterModule } from '@angular/router';

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
  megaStoneItem: Item | null;
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
export class PokemonEvolutionsComponent implements OnChanges, AfterViewChecked {
  @Input() evolutionChain: EvolutionChain | undefined = undefined;
  @Input() pokemonEvolutions: PokemonEvolution[] = [];
  @Input() currentSpecies: PokemonSpecies | undefined = undefined;

  evolutionPaths: EvolutionEntry[][] = [];
  evoGroups: EvoGroup[] = [];
  megaFormNodes: MegaNode[] = [];
  isExpanded = true;

  @ViewChildren('evoChain') evoChainRefs!: QueryList<ElementRef<HTMLElement>>;
  private needsCenterScroll = false;

  @HostBinding('class.expanded')
  get hostExpanded() { return this.isExpanded; }

  constructor(public pokemonUtils: PokemonUtilsService) { }

  ngOnChanges(): void {
    if (this.evolutionChain) {
      this.evolutionPaths = this.buildFullEvolutionPaths();
      this.evoGroups = this.buildEvoGroups();
      this.megaFormNodes = this.buildMegaFormNodes();
      this.needsCenterScroll = true;
    }
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
        if (inferredRegion) {
          result.push(path.map(s => ({ species: s, form: this.getVariantForm(s, inferredRegion), formIndex: 0 })));
        } else {
          result.push(path.map(s => ({ species: s, form: this.getDefaultForm(s), formIndex: 0 })));
        }
      }
    }

    return result;
  }

  // ── Evolution lookup ─────────────────────────────────────────────────────────

  getPokemonEvolution(id: number, formIndex?: number): PokemonEvolution[] | undefined {
    const evos = this.pokemonEvolutions.filter(evo => evo?.evolved_species_id === id);
    const seen = new Set<string>();
    const unique = evos.filter(evo => {
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
      conditions.push({ prefix: 'Level ', entity: `${evo.min_level}` });
    }

    if (evo.time_of_day) {
      conditions.push({ prefix: 'during the ', entity: evo.time_of_day });
    }

    if (evo.min_happiness != null) {
      conditions.push({ prefix: 'with high friendship' });
    }

    if (evo.min_beauty != null) {
      conditions.push({ prefix: 'with high beauty' });
    }

    if (evo.min_affection != null) {
      conditions.push({ prefix: 'with high affection' });
    }

    if (evo.item) {
      const item = evo.item;
      const name = this.pokemonUtils.getLocalizedNameFromEntity(item, 'itemnames');
      const sprite = item.itemsprites?.[0]?.sprites?.default;
      conditions.push({ prefix: 'use', entity: name, href: `/item/${name}`, spriteUrl: sprite });
    }

    if (evo.ItemByHeldItemId) {
      const item = evo.ItemByHeldItemId;
      const name = this.pokemonUtils.getLocalizedNameFromEntity(item, 'itemnames');
      const sprite = item.itemsprites?.[0]?.sprites?.default;
      conditions.push({ prefix: 'hold', entity: name, href: `/item/${name}`, spriteUrl: sprite });
    }

    if (evo.gender?.name) {
      const isFemale = evo.gender.name.toLowerCase() === 'female';
      conditions.push({ prefix: 'must be', spriteUrl: isFemale ? '/images/female.png' : '/images/male.png' });
    }

    if (evo.location) {
      const name = this.pokemonUtils.getLocalizedNameFromEntity(evo.location, 'locationnames');
      conditions.push({ prefix: 'at ', entity: name, href: `/location/${name}` });
    }

    if (evo.move) {
      const name = this.pokemonUtils.getLocalizedNameFromEntity(evo.move, 'movenames');
      conditions.push({ prefix: 'knowing the move ', entity: name, href: `/move/${name}` });
    }

    if (evo.type) {
      const name = this.pokemonUtils.getLocalizedNameFromEntity(evo.type, 'typenames');
      conditions.push({ prefix: 'knowing a ', entity: name, suffix: '-type move', href: `/type/${name}` });
    }

    if (evo.needs_overworld_rain) {
      conditions.push({ prefix: 'while raining' });
    }

    if (evo.turn_upside_down) {
      conditions.push({ prefix: 'while turning the device upside down' });
    }

    if (evo.PokemonspecyByPartySpeciesId) {
      const name = this.pokemonUtils.getLocalizedNameFromEntity(evo.PokemonspecyByPartySpeciesId, 'pokemonspeciesnames');
      conditions.push({ prefix: 'with ', entity: name, suffix: ' in party', href: `/pokemon/${name}` });
    }

    if (evo.TypeByPartyTypeId) {
      const name = this.pokemonUtils.getLocalizedNameFromEntity(evo.TypeByPartyTypeId, 'typenames');
      conditions.push({ prefix: 'with a ', entity: name, suffix: '-type Pokémon in party', href: `/type/${name}` });
    }

    if (evo.PokemonspecyByTradeSpeciesId) {
      const name = this.pokemonUtils.getLocalizedNameFromEntity(evo.PokemonspecyByTradeSpeciesId, 'pokemonspeciesnames');
      conditions.push({ prefix: 'trade with ', entity: name, href: `/pokemon/${name}` });
    }

    if (typeof evo.relative_physical_stats === 'number') {
      const statText = evo.relative_physical_stats === 1 ? 'Attack > Defense'
        : evo.relative_physical_stats === 0 ? 'Attack = Defense'
        : 'Attack < Defense';
      conditions.push({ prefix: `when ${statText}` });
    }

    if (evo.evolutiontrigger) {
      const name = this.getEvolutionTriggerName(evo.evolutiontrigger);
      if (!conditions.some(c => c.prefix === name || c.entity === name)) {
        conditions.push({ prefix: name });
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
        const megaStoneItem: Item | null = (richForm as any).pokemonitems?.[0]?.item ?? null;
        nodes.push({ species: chainSpecies, form: richForm, baseForm, megaType, megaStoneItem });
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
    const conditions: EvolutionCondition[] = [];
    if (node.megaType === 'mega' && node.megaStoneItem) {
      const name = this.pokemonUtils.getLocalizedNameFromEntity(node.megaStoneItem, 'itemnames');
      const sprite = node.megaStoneItem.itemsprites?.[0]?.sprites?.default;
      conditions.push({ prefix: 'hold', entity: name, spriteUrl: sprite });
    }
    const label = node.megaType === 'gmax' ? 'Gigantamax' : node.megaType === 'eternamax' ? 'Eternamax' : 'Mega Evolution';
    conditions.push({ prefix: label });
    return conditions;
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
