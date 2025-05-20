import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExpandableSectionComponent } from './expandable-section.component';

describe('ExpandableSectionComponent', () => {
  let component: ExpandableSectionComponent;
  let fixture: ComponentFixture<ExpandableSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpandableSectionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExpandableSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
