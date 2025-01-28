using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class ItemResponseDto
    {
        [JsonPropertyName("pokemon_v2_item")]
        public List<ItemDTO> Items { get; set; }
    }
}
