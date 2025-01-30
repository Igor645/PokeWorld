namespace Pokedex.Model
{
    public class SpeciesRowDto
    {
        public int RowId { get; set; }
        public List<PokemonSpeciesDto> PokemonSpecies { get; set; } = new();

    }
}
