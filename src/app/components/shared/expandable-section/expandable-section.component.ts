import { Component, Input } from '@angular/core';
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
        paddingTop: '*',
        paddingBottom: '*',
        marginTop: '*',
        marginBottom: '*',
        overflow: 'visible'
      })),
      state('collapsed', style({
        height: '0px',
        opacity: 0,
        paddingTop: '0',
        paddingBottom: '0',
        marginTop: '0',
        marginBottom: '0',
        overflow: 'hidden'
      })),
      transition('expanded <=> collapsed', animate('300ms ease-in-out')),
    ])
  ]
})
export class ExpandableSectionComponent {
  @Input() title: string = '';
  isExpanded = true;

  toggle(): void {
    this.isExpanded = !this.isExpanded;
  }
}
