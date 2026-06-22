import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';

export interface IndividualVersion {
  versionId: number;
  versionGroupId: number;
  label: string;
  generationId: number;
  generationName: string;
}

export interface VgOption {
  id: number;
  label: string;
  versionIds: number[];
  versions: IndividualVersion[];
  generationId: number;
  generationName: string;
}

@Injectable({ providedIn: 'root' })
export class VersionStateService {
  private _vgId$    = new BehaviorSubject<number>(0);
  private _verId$   = new BehaviorSubject<number>(0);
  private _options$ = new BehaviorSubject<VgOption[]>([]);

  /** Emits the active version-group ID (used by moves component for filtering). */
  readonly vgId$      = this._vgId$.asObservable().pipe(distinctUntilChanged());
  /** Emits the active individual version ID (used for dex entry, type display, etc.). */
  readonly versionId$ = this._verId$.asObservable().pipe(distinctUntilChanged());
  /** Full sorted option list; consumers can build their own dropdowns. */
  readonly vgOptions$ = this._options$.asObservable();

  get currentVgId():      number { return this._vgId$.value; }
  get currentVersionId(): number { return this._verId$.value; }

  setOptions(options: VgOption[]): void {
    // Newest generation first, newest vg first within same generation
    const sorted = [...options].sort((a, b) =>
      b.generationId !== a.generationId ? b.generationId - a.generationId : b.id - a.id
    );
    this._options$.next(sorted);
    const cur = this._vgId$.value;
    if (!cur || !sorted.some(o => o.id === cur)) {
      const firstVg = sorted[0];
      this._vgId$.next(firstVg?.id ?? 0);
      this._verId$.next(firstVg?.versions[0]?.versionId ?? 0);
    }
  }

  /** Called when the master version dropdown (individual version) changes. */
  selectVersion(versionId: number): void {
    for (const vg of this._options$.value) {
      const v = vg.versions.find(x => x.versionId === versionId);
      if (v) {
        this._verId$.next(versionId);
        this._vgId$.next(vg.id);
        return;
      }
    }
  }

  /** Called when the moves-toolbar version-group dropdown changes. */
  selectVersionGroup(vgId: number): void {
    const vg = this._options$.value.find(o => o.id === vgId);
    if (!vg) return;
    this._vgId$.next(vgId);
    const curVer = this._verId$.value;
    if (!vg.versions.some(v => v.versionId === curVer)) {
      this._verId$.next(vg.versions[0]?.versionId ?? 0);
    }
  }

  reset(): void {
    this._vgId$.next(0);
    this._verId$.next(0);
    this._options$.next([]);
  }
}
