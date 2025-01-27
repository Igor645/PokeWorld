using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class AggregateDto
    {
        [JsonPropertyName("count")]
        public int Count { get; set; }
    }
}
