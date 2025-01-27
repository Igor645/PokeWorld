using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class OtherSpritesDto
    {
        [JsonPropertyName("official-artwork")]
        public FlattenedPokemonSpritesDto OfficialArtwork { get; set; }

        [JsonPropertyName("dream_world")]
        public FlattenedPokemonSpritesDto DreamWorld { get; set; }

        [JsonPropertyName("home")]
        public FlattenedPokemonSpritesDto Home { get; set; }

        public OtherSpritesDto()
        {
            OfficialArtwork = new FlattenedPokemonSpritesDto();
        }
    }
}
