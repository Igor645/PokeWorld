import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-detail-row',
  standalone: true,
  templateUrl: './detail-row.component.html',
  styleUrls: ['./detail-row.component.css']
})
export class DetailRowComponent {
  @Input() label = '';
}
