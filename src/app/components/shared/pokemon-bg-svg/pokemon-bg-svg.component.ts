import { Component, Input, ChangeDetectionStrategy } from '@angular/core';



@Component({
  standalone: true,
  selector: 'app-pokemon-bg-svg',
  imports: [],
  templateUrl: './pokemon-bg-svg.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./pokemon-bg-svg.component.css']
})
export class PokemonBgSvgComponent {
  @Input() color: string = 'var(--svg-color)';
}
