namespace Pokedex.Model
{
    public class SpeciesRowDto
    {
        public int RowId { get; set; } // Unique identifier for the row
        public List<PokemonSpeciesDto> PokemonSpecies { get; set; } = new();

    }
}
