import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-detail-row',
  standalone: true,
  templateUrl: './detail-row.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./detail-row.component.css']
})
export class DetailRowComponent {
  @Input() label = '';
}
