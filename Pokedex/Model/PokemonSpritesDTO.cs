using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class PokemonSpritesDto : SpriteDto
    {
        [JsonPropertyName("other")]
        public OtherSpritesDto Other { get; set; }

        public PokemonSpritesDto()
        {
            Other = new OtherSpritesDto();
        }
    }
}
