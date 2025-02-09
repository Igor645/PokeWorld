import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PokemonBgSvgComponent } from './pokemon-bg-svg.component';

describe('PokemonBgSvgComponent', () => {
  let component: PokemonBgSvgComponent;
  let fixture: ComponentFixture<PokemonBgSvgComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PokemonBgSvgComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PokemonBgSvgComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
