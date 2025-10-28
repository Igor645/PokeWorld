import { Component, Input, OnChanges } from '@angular/core';

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
  type: Type;                     // ← for badge component
  damageClassName: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  priority: number | null;
  generationName: string;
  versionGroupId: number;         // VG filter
  machineLabel: string | null;    // TM/TR/HM (itemnames)
  methodId: number;               // method filter
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
export class PokemonMovesComponent implements OnChanges {
  @Input() pokemon: Pokemon | undefined;

  isExpanded = true;

  private allRows: Row[] = [];
  private moveById = new Map<number, Move>(); // for recomputing machine labels on VG change

  vgOptions: VgOption[] = [];
  selectedVgId = 0; // will be set to first VG if present

  methodOptions: MethodOption[] = [];
  selectedMethodId = 0; // defaults to level-up if present

  constructor(public pokemonUtils: PokemonUtilsService) { }

  ngOnChanges(): void {
    this.moveById.clear();
    this.allRows = (this.pokemon?.pokemonmoves ?? []).map(pm => this.toRow(pm));

    // Build VG options (no "All versions")
    const vgSeen = new Map<number, VgOption>();
    for (const pm of (this.pokemon?.pokemonmoves ?? [])) {
      const vg = pm.versiongroup;
      if (!vg || vgSeen.has(vg.id)) continue;
      vgSeen.set(vg.id, { id: vg.id, label: this.buildVgLabel(vg) });
    }
    this.vgOptions = Array.from(vgSeen.values());

    // Default VG = first in list (if any) or keep current if still valid
    if (this.vgOptions.length) {
      const stillValid = this.vgOptions.some(v => v.id === this.selectedVgId);
      this.selectedVgId = stillValid ? this.selectedVgId : this.vgOptions[0].id;
    } else {
      this.selectedVgId = 0;
    }

    // Build Method options
    const methodSeen = new Map<number, MethodOption>();
    for (const pm of (this.pokemon?.pokemonmoves ?? [])) {
      const m = (pm as any).movelearnmethod;
      if (!m || methodSeen.has(m.id)) continue;
      const localized = this.pokemonUtils.getLocalizedNameFromEntity(m, 'movelearnmethodnames');
      methodSeen.set(m.id, { id: m.id, label: localized, key: this.normalizeMethodKey(m.name ?? localized) });
    }
    this.methodOptions = Array.from(methodSeen.values()).sort((a, b) => a.label.localeCompare(b.label));

    // Default method = level-up if available, else first, else 0
    const levelUpOpt = this.methodOptions.find(o => o.key === 'level-up');
    if (!this.selectedMethodId || !this.methodOptions.some(o => o.id === this.selectedMethodId)) {
      this.selectedMethodId = levelUpOpt?.id ?? (this.methodOptions[0]?.id ?? 0);
    }

    this.refreshMachineLabels();
    this.sortRows();
  }

  /** Filtered rows shown in the table */
  get rows(): Row[] {
    let r = this.allRows;
    if (this.selectedVgId) r = r.filter(x => x.versionGroupId === this.selectedVgId);
    if (this.selectedMethodId) r = r.filter(x => x.methodId === this.selectedMethodId);
    return r;
  }

  /** First column header depends on method */
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
    this.refreshMachineLabels(); // machine label depends on VG
    this.sortRows();
  }

  onMethodChange(idStr: string) {
    this.selectedMethodId = Number(idStr) || 0;
    this.sortRows();
  }

  // ---------- helpers ----------

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
      type: move.type, // pass full Type for badge
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

  /** Re-derive machine labels when VG changes so machine sort is correct */
  private refreshMachineLabels(): void {
    for (const r of this.allRows) {
      const move = this.moveById.get(r.id);
      if (!move) continue;
      const pmLike = { versiongroup: { id: r.versionGroupId } } as any;
      r.machineLabel = this.computeMachineLabel(move, pmLike);
    }
  }

  /** "Scarlet / Violet" from versionGroup.versions[].versionnames */
  private buildVgLabel(versionGroup: any): string {
    const parts: string[] = (versionGroup.versions ?? [])
      .map((v: any) => this.pokemonUtils.getVersionNameByLanguage(v.versionnames))
      .filter((x: string) => !!x && x !== 'Unknown Version');
    return parts.length ? parts.join(' / ') : this.pokemonUtils.getLocalizedNameFromEntity(versionGroup, 'versiongroupnames');
  }

  /** Choose machine by current VG > row's VG > first; return localized item label uppercased */
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
      // Sort by level (nulls last), then name
      this.allRows.sort((a, b) => {
        const la = a.level ?? 999, lb = b.level ?? 999;
        return la === lb ? a.name.localeCompare(b.name, undefined, { numeric: true }) : la - lb;
      });
    } else if (key === 'machine') {
      // Sort by machine label (nulls last), then name
      this.allRows.sort((a, b) => {
        const aa = a.machineLabel ?? '\uffff'; // push nulls to bottom
        const bb = b.machineLabel ?? '\uffff';
        const cmp = aa.localeCompare(bb, undefined, { numeric: true, sensitivity: 'base' });
        return cmp !== 0 ? cmp : a.name.localeCompare(b.name, undefined, { numeric: true });
      });
    } else {
      // Tutor/Egg/Other: sort by name
      this.allRows.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    }
  }
}
