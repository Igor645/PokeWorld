import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PokemonEvolutionsComponent } from './pokemon-evolutions.component';

describe('PokemonEvolutionsComponent', () => {
  let component: PokemonEvolutionsComponent;
  let fixture: ComponentFixture<PokemonEvolutionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PokemonEvolutionsComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(PokemonEvolutionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
