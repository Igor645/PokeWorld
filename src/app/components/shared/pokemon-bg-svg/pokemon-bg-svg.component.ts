import { Component, Input } from '@angular/core';

import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-pokemon-bg-svg',
  imports: [CommonModule],
  templateUrl: './pokemon-bg-svg.component.html',
  styleUrls: ['./pokemon-bg-svg.component.css']
})
export class PokemonBgSvgComponent {
  @Input() color: string = 'var(--svg-color)';
}
