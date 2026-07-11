import { Component, Input } from '@angular/core';

import { CommonModule } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

export interface EvolutionCondition {
  prefix?: string;
  entity?: string;
  href?: string;
  spriteUrl?: string;
  suffix?: string;
  icon?: string;
}

@Component({
  selector: 'app-evolution-condition-display',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIcon],
  templateUrl: './evolution-condition-display.component.html',
  styleUrls: ['./evolution-condition-display.component.css']
})
export class EvolutionConditionDisplayComponent {
  @Input() condition!: EvolutionCondition;
}
