using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class PokemonDto
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("pokemon_v2_pokemonsprites")]
        public List<PokemonSpriteWrapperDto> PokemonSprites { get; set; }

        public PokemonDto()
        {
            Id = 0;
            PokemonSprites = new List<PokemonSpriteWrapperDto>
            {
                new PokemonSpriteWrapperDto()
            };
        }
    }
}
