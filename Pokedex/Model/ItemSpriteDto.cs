using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class ItemSpriteDto
    {
        [JsonPropertyName("default")]
        public string Default { get; set; }
    }
}
