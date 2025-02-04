import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PokeworldSearchItemComponent } from './pokeworld-search-item.component';

describe('PokeworldSearchItemComponent', () => {
  let component: PokeworldSearchItemComponent;
  let fixture: ComponentFixture<PokeworldSearchItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PokeworldSearchItemComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PokeworldSearchItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
