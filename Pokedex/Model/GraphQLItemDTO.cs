using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class GraphQLItemDTO
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; }

        [JsonPropertyName("pokemon_v2_itemsprites")]
        public List<ItemSpriteWrapperDto> ItemSprites { get; set; }
    }
}
