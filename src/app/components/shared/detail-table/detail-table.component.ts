import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-detail-table',
  standalone: true,
  template: '<ng-content></ng-content>',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./detail-table.component.css']
})
export class DetailTableComponent {}
