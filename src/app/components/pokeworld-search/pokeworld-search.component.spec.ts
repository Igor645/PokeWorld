import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PokeworldSearchComponent } from './pokeworld-search.component';

describe('PokeworldSearchComponent', () => {
  let component: PokeworldSearchComponent;
  let fixture: ComponentFixture<PokeworldSearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PokeworldSearchComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PokeworldSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
