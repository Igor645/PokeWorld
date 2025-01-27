using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class ItemSpriteWrapperDto
    {
        [JsonPropertyName("sprites")]
        public ItemSpriteDto Sprites { get; set; }
    }
}
