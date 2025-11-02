import { BehaviorSubject, Subject, combineLatest, debounceTime, distinctUntilChanged, map, shareReplay, takeUntil } from 'rxjs';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';

import { CommonModule } from '@angular/common';
import { ExpandableSectionComponent } from '../../../shared/expandable-section/expandable-section.component';
import { FormsModule } from '@angular/forms';
import { Move } from '../../../../models/move.model';
import { Pokemon } from '../../../../models/pokemon.model';
import { PokemonMove } from '../../../../models/pokemon-move.model';
import { PokemonTypeComponent } from '../../../shared/pokemon-type/pokemon-type.component';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
import { Router } from '@angular/router';
import { Type } from '../../../../models/type.model';

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
};

type VgOption = { id: number; label: string };
type MethodOption = { id: number; label: string; key: 'level-up' | 'machine' | 'tutor' | 'egg' | 'other' };

@Component({
  selector: 'app-pokemon-moves',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ExpandableSectionComponent, PokemonTypeComponent],
  templateUrl: './pokemon-moves.component.html',
  styleUrls: ['./pokemon-moves.component.css']
})
export class PokemonMovesComponent implements OnInit, OnChanges, OnDestroy {
  @Input() pokemon: Pokemon | undefined;

  private destroy$ = new Subject<void>();

  isExpanded = true;

  vgOptions: VgOption[] = [];
  methodOptions: MethodOption[] = [];

  selectedVgId = 0;
  selectedMethodId = 0;

  private allRows: Row[] = [];
  private moveById = new Map<number, Move>();
  private allMethodOptions: MethodOption[] = [];
  private methodsByVg = new Map<number, Set<number>>();
  private methodOptionsByVg = new Map<number, MethodOption[]>();
  private machineLabelCache = new Map<number, Map<number, string | null>>();

  private selectedVgId$ = new BehaviorSubject<number>(0);
  private selectedMethodId$ = new BehaviorSubject<number>(0);
  private allRows$ = new BehaviorSubject<Row[]>([]);

  rows$ = combineLatest([this.allRows$, this.selectedVgId$, this.selectedMethodId$]).pipe(
    map(([rows, vgId, methodId]) => {
      let r = vgId ? rows.filter(x => x.versionGroupId === vgId) : rows;
      r = methodId ? r.filter(x => x.methodId === methodId) : r;
      const key = this.selectedMethodKeyFromId(methodId);
      if (key === 'level-up') {
        return [...r].sort((a, b) => {
          const la = a.level ?? 999, lb = b.level ?? 999;
          return la === lb ? a.name.localeCompare(b.name, undefined, { numeric: true }) : la - lb;
        });
      } else if (key === 'machine') {
        return [...r].sort((a, b) => {
          const aa = a.machineLabel ?? '\uffff';
          const bb = b.machineLabel ?? '\uffff';
          const cmp = aa.localeCompare(bb, undefined, { numeric: true, sensitivity: 'base' });
          return cmp !== 0 ? cmp : a.name.localeCompare(b.name, undefined, { numeric: true });
        });
      }
      return [...r].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  trackById = (_: number, r: Row) => r.id;

  constructor(public pokemonUtils: PokemonUtilsService, private cdr: ChangeDetectorRef, private router: Router) { }

  ngOnInit(): void {
    this.pokemonUtils
      .watchLanguageChanges()
      .pipe(takeUntil(this.destroy$), distinctUntilChanged(), debounceTime(50))
      .subscribe(() => {
        this.relabelForLanguage();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pokemon'] && changes['pokemon'].currentValue !== changes['pokemon'].previousValue) {
      this.rebuildFromData();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onVgChange(idStr: string) {
    const id = Number(idStr);
    this.selectedVgId = id;
    this.selectedVgId$.next(id);
    this.setMethodOptionsForVg(id);
    this.refreshMachineLabelsForVg(id, this.allRows);
    this.cdr.markForCheck();
  }

  onMethodChange(idStr: string) {
    const id = Number(idStr) || 0;
    this.selectedMethodId = id;
    this.selectedMethodId$.next(id);
    this.cdr.markForCheck();
  }

  onRowClick(r: Row) {
    this.router.navigate(['move', r.name]);
  }

  private rebuildFromData(): void {
    this.moveById.clear();
    this.machineLabelCache.clear();
    this.allRows = (this.pokemon?.pokemonmoves ?? []).map(pm => this.toRow(pm));
    this.buildVgOptions();
    this.buildMethodMaster();
    this.buildIndexes(this.allRows);
    this.buildMethodOptionsByVg(this.allRows);
    if (!this.vgOptions.some(v => v.id === this.selectedVgId)) this.selectedVgId = this.vgOptions[0]?.id ?? 0;
    this.selectedVgId$.next(this.selectedVgId);
    this.setMethodOptionsForVg(this.selectedVgId);
    if (!this.methodOptions.some(o => o.id === this.selectedMethodId)) {
      const levelUp = this.methodOptions.find(o => o.key === 'level-up');
      this.selectedMethodId = levelUp?.id ?? (this.methodOptions[0]?.id ?? 0);
    }
    this.selectedMethodId$.next(this.selectedMethodId);
    this.refreshMachineLabelsForVg(this.selectedVgId, this.allRows);
    this.allRows$.next(this.allRows);
    this.cdr.markForCheck();
  }

  private buildVgOptions(): void {
    const newVgMap = new Map<number, string>();
    for (const pm of (this.pokemon?.pokemonmoves ?? [])) {
      const vg = pm.versiongroup;
      if (!vg || newVgMap.has(vg.id)) continue;
      newVgMap.set(vg.id, this.buildVgLabel(vg));
    }
    this.vgOptions = this.mergeByIdPreserveOrder(
      this.vgOptions,
      newVgMap,
      (old, label) => ({ id: old.id, label }),
      (id, label) => ({ id, label })
    );
  }

  private buildMethodMaster(): void {
    const newMethodMap = new Map<number, { label: string; key: MethodOption['key'] }>();
    for (const pm of (this.pokemon?.pokemonmoves ?? [])) {
      const m = (pm as any).movelearnmethod;
      if (!m || newMethodMap.has(m.id)) continue;
      const localized = this.pokemonUtils.getLocalizedNameFromEntity(m, 'movelearnmethodnames');
      newMethodMap.set(m.id, { label: localized, key: this.normalizeMethodKey(m.name ?? localized) });
    }
    this.allMethodOptions = this.mergeByIdPreserveOrder(
      this.allMethodOptions,
      newMethodMap,
      (old, v) => ({ id: old.id, label: v.label, key: old.key }),
      (id, v) => ({ id, label: v.label, key: v.key })
    );
  }

  private buildIndexes(rows: Row[]) {
    this.methodsByVg.clear();
    for (const r of rows) {
      let set = this.methodsByVg.get(r.versionGroupId);
      if (!set) this.methodsByVg.set(r.versionGroupId, set = new Set());
      set.add(r.methodId);
    }
  }

  private buildMethodOptionsByVg(rows: Row[]) {
    this.methodOptionsByVg.clear();
    const byVg = new Map<number, Map<number, MethodOption>>();
    for (const r of rows) {
      let methods = byVg.get(r.versionGroupId);
      if (!methods) byVg.set(r.versionGroupId, methods = new Map());
      if (!methods.has(r.methodId)) {
        const base = this.allMethodOptions.find(m => m.id === r.methodId);
        if (base) methods.set(r.methodId, base);
      }
    }
    for (const [vgId, map] of byVg) this.methodOptionsByVg.set(vgId, Array.from(map.values()));
  }

  private setMethodOptionsForVg(vgId: number) {
    if (!vgId) {
      const ids = new Set<number>(this.allRows.map(r => r.methodId));
      this.methodOptions = this.allMethodOptions.filter(o => ids.has(o.id));
    } else {
      this.methodOptions = this.methodOptionsByVg.get(vgId) ?? [];
    }
    if (!this.methodOptions.some(o => o.id === this.selectedMethodId)) {
      const levelUp = this.methodOptions.find(o => o.key === 'level-up');
      this.selectedMethodId = levelUp?.id ?? (this.methodOptions[0]?.id ?? 0);
      this.selectedMethodId$.next(this.selectedMethodId);
    }
  }

  private relabelForLanguage(): void {
    for (const r of this.allRows) {
      const move = this.moveById.get(r.id);
      if (!move) continue;
      r.name = this.pokemonUtils.getLocalizedNameFromEntity(move, 'movenames');
      r.typeName = this.pokemonUtils.getLocalizedNameFromEntity(move.type, 'typenames');
      r.damageClassName = this.pokemonUtils.getLocalizedNameFromEntity(move.movedamageclass, 'movedamageclassnames');
      r.generationName = this.pokemonUtils.getLocalizedNameFromEntity(move.generation, 'generationnames');
    }
    const vgById = new Map<number, any>();
    for (const pm of (this.pokemon?.pokemonmoves ?? [])) {
      if (pm.versiongroup) vgById.set(pm.versiongroup.id, pm.versiongroup);
    }
    this.vgOptions = this.vgOptions.map(v => ({
      id: v.id,
      label: vgById.has(v.id) ? this.buildVgLabel(vgById.get(v.id)) : v.label
    }));
    const methodById = new Map<number, any>();
    for (const pm of (this.pokemon?.pokemonmoves ?? [])) {
      const m = (pm as any).movelearnmethod;
      if (m && !methodById.has(m.id)) methodById.set(m.id, m);
    }
    this.allMethodOptions = this.allMethodOptions.map(o => {
      const m = methodById.get(o.id);
      return { ...o, label: m ? this.pokemonUtils.getLocalizedNameFromEntity(m, 'movelearnmethodnames') : o.label };
    });
    this.machineLabelCache.clear();
    this.refreshMachineLabelsForVg(this.selectedVgId, this.allRows);
    this.buildMethodOptionsByVg(this.allRows);
    this.setMethodOptionsForVg(this.selectedVgId);
    this.allRows$.next(this.allRows);
    this.cdr.markForCheck();
  }

  private refreshMachineLabelsForVg(vgId: number, rows: Row[]) {
    for (const r of rows) {
      const move = this.moveById.get(r.id);
      if (move) r.machineLabel = this.getMachineLabelCached(move, vgId || r.versionGroupId);
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
    const name = this.pokemonUtils.getLocalizedNameFromEntity(move, 'movenames');
    const typeName = this.pokemonUtils.getLocalizedNameFromEntity(move.type, 'typenames');
    const damageClassName = this.pokemonUtils.getLocalizedNameFromEntity(move.movedamageclass, 'movedamageclassnames');
    const generationName = this.pokemonUtils.getLocalizedNameFromEntity(move.generation, 'generationnames');
    const method = (pm as any).movelearnmethod;
    const methodName = this.pokemonUtils.getLocalizedNameFromEntity(method, 'movelearnmethodnames');
    const machineLabel = this.computeMachineLabel(move, pm);
    return {
      id: move.id,
      level: pm.level ?? null,
      name,
      typeName,
      type: move.type,
      damageClassName,
      power: move.power ?? null,
      accuracy: move.accuracy ?? null,
      pp: move.pp ?? null,
      priority: move.priority ?? null,
      generationName,
      versionGroupId: pm.versiongroup.id,
      machineLabel,
      methodId: method?.id ?? 0,
      methodName
    };
  }

  private buildVgLabel(versionGroup: any): string {
    const parts: string[] = (versionGroup.versions ?? [])
      .map((v: any) => this.pokemonUtils.getLocalizedNameFromEntity(v, "versionnames"))
      .filter((x: string) => !!x && x !== 'Unknown Version');
    return parts.length ? parts.join(' / ') : this.pokemonUtils.getLocalizedNameFromEntity(versionGroup, 'versiongroupnames');
  }

  private computeMachineLabel(move: Move, pm: PokemonMove | any): string | null {
    if (!move.machines.length) return null;
    let m = this.selectedVgId ? move.machines.find(x => x.version_group_id === this.selectedVgId) : undefined;
    if (!m) m = move.machines.find(x => x.version_group_id === pm?.versiongroup?.id);
    if (!m) m = move.machines[0];
    const itemLabel = this.pokemonUtils.getLocalizedNameFromEntity(m.item, 'itemnames');
    return itemLabel.toUpperCase();
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
    const opt = this.allMethodOptions.find(o => o.id === methodId) || this.methodOptions.find(o => o.id === methodId);
    return opt?.key ?? 'other';
  }

  private mergeByIdPreserveOrder<T, V>(
    prev: T[],
    next: Map<number, V>,
    updater: (oldItem: T & { id: number }, val: V) => T,
    creator: (id: number, val: V) => T
  ): T[] {
    const result: T[] = [];
    const seen = new Set<number>();
    for (const item of prev as (T & { id: number })[]) {
      const id = item.id;
      if (next.has(id)) {
        result.push(updater(item, next.get(id)!));
        seen.add(id);
      }
    }
    for (const [id, val] of next.entries()) {
      if (!seen.has(id)) result.push(creator(id, val));
    }
    return result;
  }
}
