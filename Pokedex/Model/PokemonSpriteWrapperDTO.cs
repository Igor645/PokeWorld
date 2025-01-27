using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class PokemonSpriteWrapperDto
    {
        [JsonPropertyName("sprites")]
        public PokemonSpritesDto Sprites { get; set; }

        // Default Constructor
        public PokemonSpriteWrapperDto()
        {
            Sprites = new PokemonSpritesDto();
        }
    }
}
