import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PokemonRelationsComponent } from './pokemon-relations.component';

describe('PokemonRelationsComponent', () => {
  let component: PokemonRelationsComponent;
  let fixture: ComponentFixture<PokemonRelationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PokemonRelationsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PokemonRelationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
