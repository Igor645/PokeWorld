import { Component, Input, OnChanges, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';

import { CommonModule } from '@angular/common';
import { ExpandableSectionComponent } from '../../../shared/expandable-section/expandable-section.component';
import { FormsModule } from '@angular/forms';
import { Move } from '../../../../models/move.model';
import { Pokemon } from '../../../../models/pokemon.model';
import { PokemonMove } from '../../../../models/pokemon-move.model';
import { PokemonTypeComponent } from '../../../shared/pokemon-type/pokemon-type.component';
import { PokemonUtilsService } from '../../../../utils/pokemon-utils';
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
  imports: [CommonModule, FormsModule, ExpandableSectionComponent, PokemonTypeComponent],
  templateUrl: './pokemon-moves.component.html',
  styleUrls: ['./pokemon-moves.component.css']
})
export class PokemonMovesComponent implements OnInit, OnChanges, OnDestroy {
  @Input() pokemon: Pokemon | undefined;

  private destroy$ = new Subject<void>();

  isExpanded = true;

  private allRows: Row[] = [];
  private moveById = new Map<number, Move>();

  vgOptions: VgOption[] = [];
  selectedVgId = 0;

  methodOptions: MethodOption[] = [];
  selectedMethodId = 0;

  constructor(public pokemonUtils: PokemonUtilsService) { }

  // ---------------- lifecycle ----------------

  ngOnInit(): void {
    this.pokemonUtils
      .watchLanguageChanges()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.relabelForLanguage(); // do NOT reorder or touch selections
      });
  }

  ngOnChanges(): void {
    this.rebuildFromData(); // structural changes; preserve order/selection when possible
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---------------- data build vs relabel ----------------

  /** Full rebuild when the underlying pokemon data changes (structure). */
  private rebuildFromData(): void {
    this.moveById.clear();
    this.allRows = (this.pokemon?.pokemonmoves ?? []).map(pm => this.toRow(pm));

    // --- Build "new" lists from data in FIRST-APPEARANCE order (no sorting) ---
    const newVgMap = new Map<number, string>(); // id -> label
    for (const pm of (this.pokemon?.pokemonmoves ?? [])) {
      const vg = pm.versiongroup;
      if (!vg || newVgMap.has(vg.id)) continue;
      newVgMap.set(vg.id, this.buildVgLabel(vg));
    }

    const newMethodMap = new Map<number, { label: string; key: MethodOption['key'] }>();
    for (const pm of (this.pokemon?.pokemonmoves ?? [])) {
      const m = (pm as any).movelearnmethod;
      if (!m || newMethodMap.has(m.id)) continue;
      const localized = this.pokemonUtils.getLocalizedNameFromEntity(m, 'movelearnmethodnames');
      newMethodMap.set(m.id, { label: localized, key: this.normalizeMethodKey(m.name ?? localized) });
    }

    // --- Merge to preserve existing order & selection ---
    this.vgOptions = this.mergeByIdPreserveOrder(this.vgOptions, newVgMap, (old, label) => ({ id: old.id, label }), (id, label) => ({ id, label }));
    this.methodOptions = this.mergeByIdPreserveOrder(
      this.methodOptions,
      newMethodMap,
      (old, v) => ({ id: old.id, label: v.label, key: old.key }),          // update label only
      (id, v) => ({ id, label: v.label, key: v.key })                     // append new at end
    );

    // --- Validate selections (keep them if still present) ---
    if (!this.vgOptions.some(v => v.id === this.selectedVgId)) {
      this.selectedVgId = this.vgOptions[0]?.id ?? 0;
    }
    if (!this.methodOptions.some(o => o.id === this.selectedMethodId)) {
      const levelUp = this.methodOptions.find(o => o.key === 'level-up');
      this.selectedMethodId = levelUp?.id ?? (this.methodOptions[0]?.id ?? 0);
    }

    // Machine labels depend on VG
    this.refreshMachineLabels();
    this.sortRows(); // table rows, not dropdowns
  }

  /** Only relabel text for current language. Do not touch selections or resort option arrays. */
  private relabelForLanguage(): void {
    // Relabel rows
    for (const r of this.allRows) {
      const move = this.moveById.get(r.id);
      if (!move) continue;
      r.name = this.pokemonUtils.getLocalizedNameFromEntity(move, 'movenames');
      r.typeName = this.pokemonUtils.getLocalizedNameFromEntity(move.type, 'typenames');
      r.damageClassName = this.pokemonUtils.getLocalizedNameFromEntity(move.movedamageclass, 'movedamageclassnames');
      r.generationName = this.pokemonUtils.getLocalizedNameFromEntity(move.generation, 'generationnames');
    }

    // Relabel VG options in place
    const vgById = new Map<number, any>();
    for (const pm of (this.pokemon?.pokemonmoves ?? [])) {
      if (pm.versiongroup) vgById.set(pm.versiongroup.id, pm.versiongroup);
    }
    this.vgOptions = this.vgOptions.map(v => ({
      id: v.id,
      label: vgById.has(v.id) ? this.buildVgLabel(vgById.get(v.id)) : v.label
    }));

    // Relabel method options in place
    const methodById = new Map<number, any>();
    for (const pm of (this.pokemon?.pokemonmoves ?? [])) {
      const m = (pm as any).movelearnmethod;
      if (m && !methodById.has(m.id)) methodById.set(m.id, m);
    }
    this.methodOptions = this.methodOptions.map(o => {
      const m = methodById.get(o.id);
      return { ...o, label: m ? this.pokemonUtils.getLocalizedNameFromEntity(m, 'movelearnmethodnames') : o.label };
    });

    this.refreshMachineLabels();
    this.sortRows(); // only affects table rows
  }

  // ---------------- helpers: stable merge ----------------

  /**
   * Merge "next" (Map<id, payload>) into existing list while:
   * - Keeping existing order for ids that still exist
   * - Updating labels/payload via updater
   * - Appending truly new ids at the end (using creator)
   * - Dropping ids that no longer exist
   */
  private mergeByIdPreserveOrder<T, V>(
    prev: T[],
    next: Map<number, V>,
    updater: (oldItem: T & { id: number }, val: V) => T,
    creator: (id: number, val: V) => T
  ): T[] {
    const result: T[] = [];
    const seen = new Set<number>();

    // keep existing order, update payloads
    for (const item of prev as (T & { id: number })[]) {
      const id = item.id;
      if (next.has(id)) {
        result.push(updater(item, next.get(id)!));
        seen.add(id);
      }
      // if not in next, drop it (vanished from data)
    }

    // append any brand-new ids (deterministic: by first-appearance order in "next")
    for (const [id, val] of next.entries()) {
      if (!seen.has(id)) result.push(creator(id, val));
    }

    return result;
  }

  // ---------------- getters / UI handlers ----------------

  get rows(): Row[] {
    let r = this.allRows;
    if (this.selectedVgId) r = r.filter(x => x.versionGroupId === this.selectedVgId);
    if (this.selectedMethodId) r = r.filter(x => x.methodId === this.selectedMethodId);
    return r;
  }

  get firstColHeader(): string {
    const key = this.selectedMethodKey();
    if (key === 'level-up') return 'Lv.';
    if (key === 'machine') return 'TM/TR';
    if (key === 'tutor') return 'Tutor';
    if (key === 'egg') return 'Egg';
    return '—';
  }

  onVgChange(idStr: string) {
    this.selectedVgId = Number(idStr);
    this.refreshMachineLabels();
    this.sortRows();
  }

  onMethodChange(idStr: string) {
    this.selectedMethodId = Number(idStr) || 0;
    this.sortRows();
  }

  // ---------------- helpers ----------------

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

  private refreshMachineLabels(): void {
    for (const r of this.allRows) {
      const move = this.moveById.get(r.id);
      if (!move) continue;
      const pmLike = { versiongroup: { id: r.versionGroupId } } as any;
      r.machineLabel = this.computeMachineLabel(move, pmLike);
    }
  }

  private buildVgLabel(versionGroup: any): string {
    const parts: string[] = (versionGroup.versions ?? [])
      .map((v: any) => this.pokemonUtils.getVersionNameByLanguage(v.versionnames))
      .filter((x: string) => !!x && x !== 'Unknown Version');
    return parts.length ? parts.join(' / ') : this.pokemonUtils.getLocalizedNameFromEntity(versionGroup, 'versiongroupnames');
  }

  private computeMachineLabel(move: Move, pm: PokemonMove | any): string | null {
    if (!move.machines.length) return null;

    let m = this.selectedVgId
      ? move.machines.find(x => x.version_group_id === this.selectedVgId)
      : undefined;

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

  private selectedMethodKey(): MethodOption['key'] {
    if (!this.selectedMethodId) return 'other';
    const opt = this.methodOptions.find(o => o.id === this.selectedMethodId);
    return opt?.key ?? 'other';
  }

  private sortRows(): void {
    const key = this.selectedMethodKey();
    if (key === 'level-up') {
      this.allRows.sort((a, b) => {
        const la = a.level ?? 999, lb = b.level ?? 999;
        return la === lb ? a.name.localeCompare(b.name, undefined, { numeric: true }) : la - lb;
      });
    } else if (key === 'machine') {
      this.allRows.sort((a, b) => {
        const aa = a.machineLabel ?? '\uffff';
        const bb = b.machineLabel ?? '\uffff';
        const cmp = aa.localeCompare(bb, undefined, { numeric: true, sensitivity: 'base' });
        return cmp !== 0 ? cmp : a.name.localeCompare(b.name, undefined, { numeric: true });
      });
    } else {
      this.allRows.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    }
  }
}
