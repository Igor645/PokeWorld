import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeldItemDisplayComponent } from './held-item-display.component';

describe('HeldItemDisplayComponent', () => {
  let component: HeldItemDisplayComponent;
  let fixture: ComponentFixture<HeldItemDisplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeldItemDisplayComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HeldItemDisplayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
