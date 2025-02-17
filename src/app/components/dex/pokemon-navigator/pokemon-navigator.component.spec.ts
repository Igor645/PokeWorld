import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PokemonNavigatorComponent } from './pokemon-navigator.component';

describe('PokemonNavigatorComponent', () => {
  let component: PokemonNavigatorComponent;
  let fixture: ComponentFixture<PokemonNavigatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PokemonNavigatorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PokemonNavigatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
