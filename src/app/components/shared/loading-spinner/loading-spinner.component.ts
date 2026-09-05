import { Component, Input, ChangeDetectionStrategy } from '@angular/core';



@Component({
  standalone: true,
  selector: 'app-loading-spinner',
  imports: [],
  templateUrl: './loading-spinner.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./loading-spinner.component.css']
})
export class LoadingSpinnerComponent {
  @Input() message: string = 'Loading...';
  @Input() inline: boolean = false;
}
