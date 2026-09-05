import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  DestroyRef, inject, OnInit,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';

import { Type } from '../../../../models/type.model';
import { TypeService } from '../../../../services/type.service';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { PokemonTypeComponent } from '../../../shared/pokemon-type/pokemon-type.component';
import { ExpandableSectionComponent } from '../../../shared/expandable-section/expandable-section.component';
import { DetailTableComponent } from '../../../shared/detail-table/detail-table.component';
import { DetailRowComponent } from '../../../shared/detail-row/detail-row.component';
import { PokemonDexComponent, DexPreset } from '../../../shared/pokemon-dex/pokemon-dex.component';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';
import { MoveTableRow, MovesTableComponent } from '../../../shared/moves-table/moves-table.component';
import { VersionSelectComponent, VersionSelectGroup } from '../../../shared/version-select/version-select.component';

type ActiveTab = 'pokemon' | 'moves';

interface TypeRelations {
  noDamage: Type[];
  halfDamage: Type[];
  doubleDamage: Type[];
}

@Component({
  selector: 'app-type-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    FormsModule,
    MatIcon,
    PokemonTypeComponent,
    ExpandableSectionComponent,
    DetailTableComponent,
    DetailRowComponent,
    PokemonDexComponent,
    LoadingSpinnerComponent,
    MovesTableComponent,
    VersionSelectComponent,
  ],
  templateUrl: './type-detail.component.html',
  styleUrls: ['./type-detail.component.css'],
})
export class TypeDetailComponent implements OnInit {
  type: Type | null = null;
  allTypes: Type[] = [];
  isLoading = true;
  notFound = false;

  offensive: TypeRelations = { noDamage: [], halfDamage: [], doubleDamage: [] };
  defensive: TypeRelations = { noDamage: [], halfDamage: [], doubleDamage: [] };

  activeTab: ActiveTab = 'pokemon';

  // Moves
  private rawMoves: any[] = [];
  isLoadingMoves = false;
  private movesLoaded = false;

  selectedVgId = 0;
  versionSelectGroups: VersionSelectGroup[] = [];

  get filteredMoves(): MoveTableRow[] {
    const vgId = this.selectedVgId || null;
    return this.rawMoves.map(m => this.toMoveRow(m, vgId));
  }

  get dexPreset(): DexPreset {
    return { lockedTypeId: this.type?.id, title: this.getLocalizedName() + '-type Pokémon' };
  }

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private route: ActivatedRoute,
    private typeService: TypeService,
    public pokemonUtils: PokemonUtilsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap(params => {
        const name = (params.get('typeName') ?? '').toLowerCase();
        this.isLoading = true;
        this.type = null;
        this.notFound = false;
        this.rawMoves = [];
        this.movesLoaded = false;
        this.activeTab = 'pokemon';
        this.selectedVgId = 0;
        this.versionSelectGroups = [];
        this.cdr.detectChanges();
        return this.typeService.getAllTypes().pipe(
          map(res => ({ name, types: res.type })),
          catchError(() => of({ name, types: [] as Type[] })),
        );
      }),
    ).subscribe(({ name, types }) => {
      this.allTypes = types;
      this.type = types.find(t =>
        t.name.toLowerCase() === name ||
        t.typenames.some(tn => tn.name.toLowerCase() === name)
      ) ?? null;
      if (this.type) this.computeMatchups();
      else this.notFound = types.length > 0;
      this.isLoading = false;
      this.cdr.detectChanges();
    });
  }

  setTab(tab: ActiveTab): void {
    this.activeTab = tab;
    if (tab === 'moves' && !this.movesLoaded && !this.isLoadingMoves && this.type) {
      this.loadMoves(this.type.id);
    }
    this.cdr.detectChanges();
  }

  onVgChange(id: number): void {
    this.selectedVgId = id;
    this.cdr.detectChanges();
  }

  getLocalizedName(): string {
    return this.type ? this.pokemonUtils.getLocalizedNameFromEntity(this.type, 'typenames') : '';
  }

  getTypeIcon(): string {
    return `/images/type-icons/${this.type?.name ?? 'normal'}.svg`;
  }

  private loadMoves(typeId: number): void {
    this.isLoadingMoves = true;
    this.cdr.detectChanges();
    this.typeService.getMovesByType(typeId).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: res => {
        this.rawMoves = res.move ?? [];
        this.buildVersionGroups();
        this.movesLoaded = true;
        this.isLoadingMoves = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.movesLoaded = true;
        this.isLoadingMoves = false;
        this.cdr.detectChanges();
      },
    });
  }

  private buildVersionGroups(): void {
    const vgMap = new Map<number, any>();
    for (const m of this.rawMoves) {
      for (const ft of m.moveflavortexts ?? []) {
        const vg = ft.versiongroup;
        if (vg && !vgMap.has(vg.id)) vgMap.set(vg.id, vg);
      }
    }

    const genMap = new Map<number, { generationName: string; generationId: number; options: { id: number; label: string }[] }>();
    for (const vg of vgMap.values()) {
      const genId = vg.generation?.id ?? 0;
      const genName = this.pokemonUtils.getLocalizedNameFromEntity(vg.generation, 'generationnames');
      let group = genMap.get(genId);
      if (!group) genMap.set(genId, group = { generationName: genName, generationId: genId, options: [] });
      group.options.push({ id: vg.id, label: this.buildVgLabel(vg) });
    }

    this.versionSelectGroups = Array.from(genMap.values())
      .sort((a, b) => b.generationId - a.generationId)
      .map(g => ({ generationName: g.generationName, options: g.options }));

    // Default to the newest version group
    if (this.versionSelectGroups.length) {
      this.selectedVgId = this.versionSelectGroups[0].options[0]?.id ?? 0;
    }
  }

  private buildVgLabel(vg: any): string {
    const parts: string[] = (vg.versions ?? [])
      .map((v: any) => this.pokemonUtils.getLocalizedNameFromEntity(v, 'versionnames'))
      .filter((x: string) => !!x && x !== 'Unknown Version');
    return parts.length ? parts.join(' / ') : (vg.name ?? '');
  }

  private toMoveRow(m: any, vgId: number | null): MoveTableRow {
    return {
      id: m.id,
      name: this.pokemonUtils.getLocalizedNameFromEntity(m, 'movenames'),
      flavorText: this.pokemonUtils.getLocalizedFlavorTextFromEntity(m, 'moveflavortexts', vgId),
      damageClass: this.pokemonUtils.getLocalizedNameFromEntity(m.movedamageclass, 'movedamageclassnames'),
      power: m.power ?? null,
      accuracy: m.accuracy ?? null,
      pp: m.pp ?? null,
      priority: m.priority ?? null,
      generationName: this.pokemonUtils.getLocalizedNameFromEntity(m.generation, 'generationnames'),
    };
  }

  private computeMatchups(): void {
    if (!this.type) return;

    const off: TypeRelations = { noDamage: [], halfDamage: [], doubleDamage: [] };
    for (const eff of this.type.typeefficacies) {
      const target = eff.TypeByTargetTypeId;
      if (!target) continue;
      if (eff.damage_factor === 0)        off.noDamage.push(target);
      else if (eff.damage_factor === 50)  off.halfDamage.push(target);
      else if (eff.damage_factor === 200) off.doubleDamage.push(target);
    }
    this.offensive = off;

    const def: TypeRelations = { noDamage: [], halfDamage: [], doubleDamage: [] };
    for (const attackType of this.allTypes) {
      const eff = attackType.typeefficacies.find(e => e.target_type_id === this.type!.id);
      if (!eff) continue;
      if (eff.damage_factor === 0)        def.noDamage.push(attackType);
      else if (eff.damage_factor === 50)  def.halfDamage.push(attackType);
      else if (eff.damage_factor === 200) def.doubleDamage.push(attackType);
    }
    this.defensive = def;
  }
}
