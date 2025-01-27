using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class LanguageDto
    {
        [JsonPropertyName("name")]
        public string Name { get; set; }
    }
}
