import { Component, Input, OnInit, Optional, Self } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InteractiveHostDirective } from '../../../../shared/directives/interactive-host.directive';

@Component({
  selector: 'app-held-item-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './held-item-display.component.html',
  styleUrls: ['./held-item-display.component.css'],
  hostDirectives: [InteractiveHostDirective]
})
export class HeldItemDisplayComponent implements OnInit {
  @Input() name!: string;
  @Input() rarity!: number;
  @Input() iconUrl!: string | undefined;

  constructor(@Self() @Optional() private interactiveHost?: InteractiveHostDirective) { }

  ngOnInit(): void {
    if (this.interactiveHost) {
      this.interactiveHost.href = '/item/' + this.name;
    }
  }
}
