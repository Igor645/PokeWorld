import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EvolutionConditionComponent } from './evolution-condition-display.component';

describe('EvolutionConditionComponent', () => {
  let component: EvolutionConditionComponent;
  let fixture: ComponentFixture<EvolutionConditionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EvolutionConditionComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(EvolutionConditionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
