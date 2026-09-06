import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

export interface Tab {
  id: string;
  label: string;
  icon?: string;
}

@Component({
  selector: 'app-tab-bar',
  standalone: true,
  imports: [MatIcon],
  templateUrl: './tab-bar.component.html',
  styleUrls: ['./tab-bar.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabBarComponent {
  @Input() tabs: Tab[] = [];
  @Input() activeTab = '';
  @Output() tabChange = new EventEmitter<string>();
}
