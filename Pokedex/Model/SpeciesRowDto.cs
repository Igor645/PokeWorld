namespace Pokedex.Model
{
    public class SpeciesRowDto
    {
        public int RowId { get; set; }
        public List<GraphQLPokemonSpeciesDTO> PokemonSpecies { get; set; } = new();

    }
}
