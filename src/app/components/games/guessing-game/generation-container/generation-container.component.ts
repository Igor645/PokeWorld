import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PokemonService } from '../../../../services/pokemon.service';
import { GuessingPokemonIconComponent } from '../guessing-pokemon-icon/guessing-pokemon-icon.component';
import { PokemonSpecies } from '../../../../models/pokemon-species.model';

@Component({
  selector: 'app-generation-container',
  standalone: true,
  imports: [CommonModule, GuessingPokemonIconComponent],
  templateUrl: './generation-container.component.html',
  styleUrl: './generation-container.component.css'
})
export class GenerationContainerComponent implements OnInit {
  @Input() generationId!: number;
  @Input() generationName!: string;

  pokemonList: PokemonSpecies[] = [];

  constructor(private pokemonService: PokemonService) {}

  ngOnInit(): void {
    this.fetchPokemonByGeneration();
  }

  private fetchPokemonByGeneration(): void {
    this.pokemonService.getPokemonSpeciesByGenerationId(this.generationId).subscribe(response => {
      this.pokemonList = response.pokemon_v2_pokemonspecies;
    });
  }
}
