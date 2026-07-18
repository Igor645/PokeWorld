import { Component, EventEmitter, Input, Output } from '@angular/core';


export interface VersionSelectGroup {
  generationName: string;
  options: { id: number; label: string }[];
}

@Component({
  selector: 'app-version-select',
  standalone: true,
  imports: [],
  templateUrl: './version-select.component.html',
  styleUrls: ['./version-select.component.css']
})
export class VersionSelectComponent {
  @Input() groups: VersionSelectGroup[] = [];
  @Input() selectedId = 0;
  @Output() selectionChange = new EventEmitter<number>();

  onChange(event: Event): void {
    this.selectionChange.emit(Number((event.target as HTMLSelectElement).value));
  }
}
