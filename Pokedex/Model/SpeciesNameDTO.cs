using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class SpeciesNameDto
    {
        [JsonPropertyName("name")]
        public string Name { get; set; }

        [JsonPropertyName("pokemon_v2_language")]
        public LanguageDto Language { get; set; }
    }
}
