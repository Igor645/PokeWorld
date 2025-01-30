using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class StatDto
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;
    }
}
