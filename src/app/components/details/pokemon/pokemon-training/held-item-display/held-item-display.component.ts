import { Component, Input, OnInit, Optional, Self, ChangeDetectionStrategy } from '@angular/core';

import { InteractiveHostDirective } from '../../../../shared/directives/interactive-host.directive';

@Component({
  selector: 'app-held-item-display',
  standalone: true,
  imports: [],
  templateUrl: './held-item-display.component.html',
  styleUrls: ['./held-item-display.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
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
