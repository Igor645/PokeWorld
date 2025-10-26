import { Component, HostBinding, Input, model } from '@angular/core';
import { animate, state, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-expandable-section',
  standalone: true,
  templateUrl: './expandable-section.component.html',
  styleUrls: ['./expandable-section.component.css'],
  animations: [
    trigger('expandCollapse', [
      state('expanded', style({
        height: '*',
        opacity: 1,
        overflow: 'visible'
      })),
      state('collapsed', style({
        height: '0px',
        opacity: 0,
        overflow: 'hidden'
      })),
      transition('expanded <=> collapsed', animate('300ms ease-in-out'))
    ])
  ]
})
export class ExpandableSectionComponent {
  @Input() title = '';
  expanded = model<boolean>(true);

  @HostBinding('class.expanded')
  get expandedClass() {
    return this.expanded();
  }

  toggle() {
    this.expanded.update(v => !v);
  }
}
