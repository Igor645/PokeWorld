import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GuessingPokemonIconComponent } from './guessing-pokemon-icon.component';

describe('GuessingPokemonIconComponent', () => {
  let component: GuessingPokemonIconComponent;
  let fixture: ComponentFixture<GuessingPokemonIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuessingPokemonIconComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GuessingPokemonIconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
