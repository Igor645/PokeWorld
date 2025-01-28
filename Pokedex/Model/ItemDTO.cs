using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class ItemDTO
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; }

        [JsonPropertyName("pokemon_v2_itemsprites")]
        public List<SpriteWrapperDTO<ItemSpriteDto>> ItemSprites { get; set; }
    }
}
