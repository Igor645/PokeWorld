using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class OtherSpritesDto
    {
        [JsonPropertyName("official-artwork")]
        public SpriteDto OfficialArtwork { get; set; }

        [JsonPropertyName("dream_world")]
        public SpriteDto DreamWorld { get; set; }

        [JsonPropertyName("home")]
        public SpriteDto Home { get; set; }

        public OtherSpritesDto()
        {
            OfficialArtwork = new SpriteDto();
        }
    }
}
