import { BehaviorSubject, Subject, combineLatest, debounceTime, distinctUntilChanged, filter, map, shareReplay, takeUntil } from 'rxjs';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';

import { CommonModule } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { ExpandableSectionComponent } from '../../../shared/expandable-section/expandable-section.component';
import { FormsModule } from '@angular/forms';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';
import { Move } from '../../../../models/move.model';
import { PokemonMove } from '../../../../models/pokemon-move.model';
import { PokemonService } from '../../../../services/pokemon.service';
import { PokemonTypeComponent } from '../../../shared/pokemon-type/pokemon-type.component';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { Router } from '@angular/router';
import { Type } from '../../../../models/type.model';
import { IndividualVersion, VgOption, VersionStateService } from '../../../../services/version-state.service';
import { VersionSelectComponent, VersionSelectGroup } from '../../../shared/version-select/version-select.component';

type Row = {
  id: number;
  level: number | null;
  name: string;
  typeName: string;
  type: Type;
  damageClassName: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  priority: number | null;
  generationName: string;
  versionGroupId: number;
  machineLabel: string | null;
  methodId: number;
  methodName: string;
  flavorText: string;
};

type MethodOption = { id: number; label: string; key: 'level-up' | 'machine' | 'tutor' | 'egg' | 'other' };

@Component({
  selector: 'app-pokemon-moves',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MatIcon, ExpandableSectionComponent, PokemonTypeComponent, LoadingSpinnerComponent, VersionSelectComponent],
  templateUrl: './pokemon-moves.component.html',
  styleUrls: ['./pokemon-moves.component.css']
})
export class PokemonMovesComponent implements OnInit, OnChanges, OnDestroy {
  @Input() pokemonId: number | undefined;

  isExpanded = true;
  isLoadingOptions = false;
  isLoadingMoves = false;

  vgOptions: VgOption[] = [];
  methodOptions: MethodOption[] = [];
  selectedVgId = 0;
  selectedMethodId = 0;

  private destroy$ = new Subject<void>();
  private allRows: Row[] = [];
  private moveById = new Map<number, Move>();
  private allMethodOptions: MethodOption[] = [];
  private methodsByVg = new Map<number, Set<number>>();
  private vgDataById = new Map<number, any>();
  private methodDataById = new Map<number, any>();
  private machineLabelCache = new Map<number, Map<number, string | null>>();

  private selectedMethodId$ = new BehaviorSubject<number>(0);
  private allRows$ = new BehaviorSubject<Row[]>([]);

  rows$ = combineLatest([this.allRows$, this.selectedMethodId$]).pipe(
    map(([rows, methodId]) => {
      const key = this.selectedMethodKeyFromId(methodId);
      if (key === 'level-up') {
        return [...rows].sort((a, b) => {
          const la = a.level ?? 999, lb = b.level ?? 999;
          return la === lb ? a.name.localeCompare(b.name, undefined, { numeric: true }) : la - lb;
        });
      } else if (key === 'machine') {
        return [...rows].sort((a, b) => {
          const aa = a.machineLabel ?? '￿';
          const bb = b.machineLabel ?? '￿';
          const cmp = aa.localeCompare(bb, undefined, { numeric: true, sensitivity: 'base' });
          return cmp !== 0 ? cmp : a.name.localeCompare(b.name, undefined, { numeric: true });
        });
      }
      return [...rows].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  trackById = (_: number, r: Row) => r.id;

  get groupedVgOptions(): { generationName: string; generationId: number; options: VgOption[] }[] {
    const genMap = new Map<number, { generationName: string; generationId: number; options: VgOption[] }>();
    for (const vg of this.vgOptions) {
      let gen = genMap.get(vg.generationId);
      if (!gen) genMap.set(vg.generationId, gen = { generationName: vg.generationName, generationId: vg.generationId, options: [] });
      gen.options.push(vg);
    }
    return Array.from(genMap.values()).sort((a, b) => b.generationId - a.generationId);
  }

  get versionSelectGroups(): VersionSelectGroup[] {
    return this.groupedVgOptions.map(g => ({
      generationName: g.generationName,
      options: g.options.map(vg => ({ id: vg.id, label: vg.label }))
    }));
  }

  constructor(
    public pokemonUtils: PokemonUtilsService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private pokemonService: PokemonService,
    private versionState: VersionStateService,
  ) { }

  ngOnInit(): void {
    this.pokemonUtils
      .watchLanguageChanges()
      .pipe(takeUntil(this.destroy$), distinctUntilChanged(), debounceTime(50))
      .subscribe(() => this.relabelForLanguage());

    // Keep toolbar dropdown in sync with service's sorted order
    this.versionState.vgOptions$
      .pipe(takeUntil(this.destroy$))
      .subscribe(opts => { this.vgOptions = opts; this.cdr.detectChanges(); });

    // React to master version selector or any external vg change
    this.versionState.vgId$
      .pipe(takeUntil(this.destroy$), filter(id => !!id))
      .subscribe(vgId => {
        if (vgId === this.selectedVgId || !this.vgOptions.some(v => v.id === vgId)) return;
        this.selectedVgId = vgId;
        this.setMethodOptionsForVg(vgId);
        if (this.pokemonId) this.loadMovesForSelection();
        this.cdr.detectChanges();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pokemonId'] && changes['pokemonId'].currentValue !== changes['pokemonId'].previousValue) {
      this.loadOptions(changes['pokemonId'].currentValue);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onVgChange(id: number): void {
    this.versionState.selectVersionGroup(id);
  }

  onMethodChange(idStr: string): void {
    const id = Number(idStr) || 0;
    this.selectedMethodId = id;
    this.selectedMethodId$.next(id);
    this.loadMovesForSelection();
    this.cdr.detectChanges();
  }

  onRowClick(r: Row): void {
    this.router.navigate(['move', r.name]);
  }

  private loadOptions(pokemonId: number | undefined): void {
    if (!pokemonId) {
      this.clearAll();
      return;
    }
    this.isLoadingOptions = true;
    this.allRows$.next([]);
    this.cdr.detectChanges();

    this.pokemonService.getPokemonMoveOptions(pokemonId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (options) => {
        if (pokemonId !== this.pokemonId) return;
        this.processOptions(options);
        this.isLoadingOptions = false;
        this.loadMovesForSelection();
        this.cdr.detectChanges();
      },
      error: () => {
        if (pokemonId !== this.pokemonId) return;
        this.clearAll();
        this.isLoadingOptions = false;
        this.cdr.detectChanges();
      }
    });
  }

  private loadMovesForSelection(): void {
    const { pokemonId, selectedVgId, selectedMethodId } = this;
    if (!pokemonId || !selectedVgId || !selectedMethodId) return;

    this.isLoadingMoves = true;
    this.cdr.detectChanges();

    this.pokemonService.getPokemonMovesByFilter(pokemonId, selectedVgId, selectedMethodId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (moves) => {
          if (pokemonId !== this.pokemonId || selectedVgId !== this.selectedVgId || selectedMethodId !== this.selectedMethodId) return;
          this.buildRows(moves);
          this.isLoadingMoves = false;
          this.cdr.detectChanges();
        },
        error: () => {
          if (pokemonId !== this.pokemonId) return;
          this.allRows$.next([]);
          this.isLoadingMoves = false;
          this.cdr.detectChanges();
        }
      });
  }

  private processOptions(rawOptions: Array<{ versiongroup: any; movelearnmethod: any }>): void {
    const vgMap = new Map<number, any>();
    const methodMap = new Map<number, any>();
    const methodsByVg = new Map<number, Set<number>>();

    for (const opt of rawOptions) {
      const vg = opt.versiongroup;
      const method = opt.movelearnmethod;
      if (vg && !vgMap.has(vg.id)) vgMap.set(vg.id, vg);
      if (method && !methodMap.has(method.id)) methodMap.set(method.id, method);
      if (vg && method) {
        let set = methodsByVg.get(vg.id);
        if (!set) methodsByVg.set(vg.id, set = new Set());
        set.add(method.id);
      }
    }

    this.vgDataById = vgMap;
    this.methodDataById = methodMap;
    this.methodsByVg = methodsByVg;

    const rawOpts = Array.from(vgMap.values()).map(vg => this.toVgOption(vg));

    // Compute the vgId the service will pick after setOptions (newest-first sort)
    const sorted = [...rawOpts].sort((a, b) =>
      b.generationId !== a.generationId ? b.generationId - a.generationId : b.id - a.id
    );
    const curVgId = this.versionState.currentVgId;
    const nextVgId = sorted.some(v => v.id === curVgId) ? curVgId : (sorted[0]?.id ?? 0);

    // Pre-set so the vgId$ subscription guard fires and doesn't trigger a redundant load
    this.selectedVgId = nextVgId;

    // Publish — vgOptions$ subscription updates this.vgOptions with sorted list
    this.versionState.setOptions(rawOpts);

    this.allMethodOptions = Array.from(methodMap.values()).map(m => ({
      id: m.id,
      label: this.pokemonUtils.getLocalizedNameFromEntity(m, 'movelearnmethodnames'),
      key: this.normalizeMethodKey(m.name)
    }));

    this.setMethodOptionsForVg(this.selectedVgId);
  }

  private toVgOption(vg: any): VgOption {
    const generationId   = vg.generation?.id ?? 0;
    const generationName = this.pokemonUtils.getLocalizedNameFromEntity(vg.generation, 'generationnames');
    const versions: IndividualVersion[] = (vg.versions ?? [])
      .filter((v: any) => !!v.id)
      .map((v: any) => ({
        versionId:      v.id,
        versionGroupId: vg.id,
        label:          this.pokemonUtils.getLocalizedNameFromEntity(v, 'versionnames'),
        generationId,
        generationName,
      }));
    return {
      id: vg.id,
      label: this.buildVgLabel(vg),
      versionIds: versions.map(v => v.versionId),
      versions,
      generationId,
      generationName,
    };
  }

  private setMethodOptionsForVg(vgId: number): void {
    const validIds = this.methodsByVg.get(vgId) ?? new Set<number>();
    this.methodOptions = this.allMethodOptions.filter(o => validIds.has(o.id));
    if (!this.methodOptions.some(o => o.id === this.selectedMethodId)) {
      const levelUp = this.methodOptions.find(o => o.key === 'level-up');
      this.selectedMethodId = levelUp?.id ?? this.methodOptions[0]?.id ?? 0;
      this.selectedMethodId$.next(this.selectedMethodId);
    }
  }

  private buildRows(moves: PokemonMove[]): void {
    this.moveById.clear();
    this.machineLabelCache.clear();
    this.allRows = moves.map(pm => this.toRow(pm));
    this.refreshMachineLabelsForVg(this.selectedVgId, this.allRows);
    this.refreshFlavorTextsForVg(this.selectedVgId, this.allRows);
    this.allRows$.next(this.allRows);
  }

  private clearAll(): void {
    this.vgOptions = [];
    this.methodOptions = [];
    this.allMethodOptions = [];
    this.moveById.clear();
    this.vgDataById.clear();
    this.methodDataById.clear();
    this.methodsByVg.clear();
    this.allRows = [];
    this.allRows$.next([]);
  }

  private relabelForLanguage(): void {
    if (!this.allRows.length && !this.vgOptions.length) return;

    for (const r of this.allRows) {
      const move = this.moveById.get(r.id);
      if (!move) continue;
      r.name = this.pokemonUtils.getLocalizedNameFromEntity(move, 'movenames');
      r.typeName = this.pokemonUtils.getLocalizedNameFromEntity(move.type, 'typenames');
      r.damageClassName = this.pokemonUtils.getLocalizedNameFromEntity(move.movedamageclass, 'movedamageclassnames');
      r.generationName = this.pokemonUtils.getLocalizedNameFromEntity(move.generation, 'generationnames');
      r.flavorText = this.pokemonUtils.getLocalizedFlavorTextFromEntity(move, 'moveflavortexts', r.versionGroupId);
    }

    this.vgOptions = this.vgOptions.map(v => {
      const vg = this.vgDataById.get(v.id);
      return vg ? this.toVgOption(vg) : v;
    });
    this.versionState.setOptions(this.vgOptions);

    this.allMethodOptions = this.allMethodOptions.map(o => {
      const m = this.methodDataById.get(o.id);
      return { ...o, label: m ? this.pokemonUtils.getLocalizedNameFromEntity(m, 'movelearnmethodnames') : o.label };
    });
    this.setMethodOptionsForVg(this.selectedVgId);

    this.machineLabelCache.clear();
    this.refreshMachineLabelsForVg(this.selectedVgId, this.allRows);
    this.refreshFlavorTextsForVg(this.selectedVgId, this.allRows);
    this.allRows$.next([...this.allRows]);
    this.cdr.detectChanges();
  }

  private refreshMachineLabelsForVg(vgId: number, rows: Row[]): void {
    for (const r of rows) {
      const move = this.moveById.get(r.id);
      if (move) r.machineLabel = this.getMachineLabelCached(move, vgId || r.versionGroupId);
    }
  }

  private refreshFlavorTextsForVg(vgId: number, rows: Row[]): void {
    for (const r of rows) {
      const move = this.moveById.get(r.id);
      if (!move) continue;
      r.flavorText = this.pokemonUtils.getLocalizedFlavorTextFromEntity(move, 'moveflavortexts', vgId || r.versionGroupId);
    }
  }

  private getMachineLabelCached(move: Move, vgId: number): string | null {
    let byVg = this.machineLabelCache.get(move.id);
    if (!byVg) this.machineLabelCache.set(move.id, byVg = new Map());
    if (byVg.has(vgId)) return byVg.get(vgId)!;
    let m = move.machines.find(x => x.version_group_id === vgId);
    if (!m) m = move.machines[0];
    const label = m ? this.pokemonUtils.getLocalizedNameFromEntity(m.item, 'itemnames').toUpperCase() : null;
    byVg.set(vgId, label);
    return label;
  }

  private toRow(pm: PokemonMove): Row {
    const move: Move = pm.move;
    this.moveById.set(move.id, move);
    const method = (pm as any).movelearnmethod;
    return {
      id: move.id,
      level: pm.level ?? null,
      name: this.pokemonUtils.getLocalizedNameFromEntity(move, 'movenames'),
      typeName: this.pokemonUtils.getLocalizedNameFromEntity(move.type, 'typenames'),
      type: move.type,
      damageClassName: this.pokemonUtils.getLocalizedNameFromEntity(move.movedamageclass, 'movedamageclassnames'),
      power: move.power ?? null,
      accuracy: move.accuracy ?? null,
      pp: move.pp ?? null,
      priority: move.priority ?? null,
      generationName: this.pokemonUtils.getLocalizedNameFromEntity(move.generation, 'generationnames'),
      versionGroupId: pm.versiongroup.id,
      machineLabel: this.computeMachineLabel(move),
      methodId: method?.id ?? 0,
      methodName: this.pokemonUtils.getLocalizedNameFromEntity(method, 'movelearnmethodnames'),
      flavorText: this.pokemonUtils.getLocalizedFlavorTextFromEntity(move, 'moveflavortexts', pm.versiongroup.id)
    };
  }

  private buildVgLabel(versionGroup: any): string {
    const parts: string[] = (versionGroup.versions ?? [])
      .map((v: any) => this.pokemonUtils.getLocalizedNameFromEntity(v, 'versionnames'))
      .filter((x: string) => !!x && x !== 'Unknown Version');
    return parts.length ? parts.join(' / ') : this.pokemonUtils.getLocalizedNameFromEntity(versionGroup, 'versiongroupnames');
  }

  private computeMachineLabel(move: Move): string | null {
    if (!move.machines.length) return null;
    const m = move.machines.find(x => x.version_group_id === this.selectedVgId) ?? move.machines[0];
    return this.pokemonUtils.getLocalizedNameFromEntity(m.item, 'itemnames').toUpperCase();
  }

  private normalizeMethodKey(name: string | undefined): MethodOption['key'] {
    const n = (name ?? '').toLowerCase();
    if (n.includes('level')) return 'level-up';
    if (n.includes('machine') || n.startsWith('tm') || n.startsWith('tr')) return 'machine';
    if (n.includes('tutor')) return 'tutor';
    if (n.includes('egg')) return 'egg';
    return 'other';
  }

  selectedMethodKeyFromId(methodId: number): MethodOption['key'] {
    if (!methodId) return 'other';
    return (this.allMethodOptions.find(o => o.id === methodId) ?? this.methodOptions.find(o => o.id === methodId))?.key ?? 'other';
  }
}
