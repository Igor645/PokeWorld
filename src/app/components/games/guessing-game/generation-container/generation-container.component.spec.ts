import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenerationContainerComponent } from './generation-container.component';

describe('GenerationContainerComponent', () => {
  let component: GenerationContainerComponent;
  let fixture: ComponentFixture<GenerationContainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenerationContainerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GenerationContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
