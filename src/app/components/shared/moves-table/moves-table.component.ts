import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { PokemonTypeComponent } from '../pokemon-type/pokemon-type.component';
import { LoadingSpinnerComponent } from '../loading-spinner/loading-spinner.component';

export interface MoveTableRow {
  id: number;
  name: string;
  type?: any;
  flavorText: string;
  damageClass: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  priority: number | null;
  generationName: string;
  generationId?: number;
  learnValue?: string | null;
}

@Component({
  selector: 'app-moves-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [PokemonTypeComponent, LoadingSpinnerComponent],
  templateUrl: './moves-table.component.html',
  styleUrls: ['./moves-table.component.css'],
})
export class MovesTableComponent {
  @Input() rows: MoveTableRow[] = [];
  @Input() isLoading = false;
  @Input() showLearnCol = false;
  @Input() showTypeCol = true;
  @Input() learnColHeader = 'Lv.';
  @Output() rowClick = new EventEmitter<MoveTableRow>();

  trackById(_: number, r: MoveTableRow): number { return r.id; }
}
