namespace Pokedex.Model
{
    public class SpeciesRowDto
    {
        public int RowId { get; set; }
        public List<PokemonSpeciesDTO> PokemonSpecies { get; set; } = new();

    }
}
