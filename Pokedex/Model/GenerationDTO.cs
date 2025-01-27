using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class GenerationDto
    {
        [JsonPropertyName("name")]
        public string Name { get; set; }
    }
}
