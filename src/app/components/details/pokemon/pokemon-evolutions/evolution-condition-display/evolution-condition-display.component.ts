import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

import { NgClass } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

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
  imports: [NgClass, RouterLink, MatIcon],
  templateUrl: './evolution-condition-display.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./evolution-condition-display.component.css']
})
export class EvolutionConditionDisplayComponent {
  @Input() condition!: EvolutionCondition;
}
