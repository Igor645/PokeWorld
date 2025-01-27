using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class PokemonSpeciesAggregateDto
    {
        [JsonPropertyName("aggregate")]
        public AggregateDto Aggregate { get; set; }
    }
}
