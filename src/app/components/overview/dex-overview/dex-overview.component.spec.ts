import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DexOverviewComponent } from './dex-overview.component';

describe('DexOverviewComponent', () => {
  let component: DexOverviewComponent;
  let fixture: ComponentFixture<DexOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DexOverviewComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(DexOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
