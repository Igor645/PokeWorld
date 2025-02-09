import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DexEntryComponent } from './dex-entry.component';

describe('DexEntryComponent', () => {
  let component: DexEntryComponent;
  let fixture: ComponentFixture<DexEntryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DexEntryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DexEntryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
