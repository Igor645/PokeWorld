namespace Pokedex.Model
{
    public class SpeciesRowDto
    {
        public int RowId { get; set; } // Unique identifier for the row
        public List<GraphQLPokemonSpeciesDTO> PokemonSpecies { get; set; } = new();

    }
}
