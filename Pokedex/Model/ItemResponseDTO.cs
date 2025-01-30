using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class ItemResponseDto
    {
        [JsonPropertyName("pokemon_v2_item")]
        public List<ItemDto> Items { get; set; }
    }
}
