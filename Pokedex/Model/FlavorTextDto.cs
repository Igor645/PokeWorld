using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class FlavorTextDto
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }
        
        [JsonPropertyName("flavor_text")]
        public string FlavorText { get; set; }
        
        [JsonPropertyName("pokemon_v2_language")]
        public LanguageDto Language { get; set; }
        
        [JsonPropertyName("pokemon_v2_version")]
        public VersionDto Version { get; set; }
    }
}
