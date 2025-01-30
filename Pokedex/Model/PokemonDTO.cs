using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class PokemonDto
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("is_default")]
        public bool IsDefault { get; set; }

        [JsonPropertyName("pokemon_v2_pokemonsprites")]
        public List<SpriteWrapperDto<PokemonSpritesDto>> PokemonSprites { get; set; }

        [JsonPropertyName("pokemon_v2_pokemonstats")]
        public List<PokemonStatDto> Stats { get; set; }

        public PokemonDto()
        {
            Id = 0;
            Name = string.Empty;
            IsDefault = true;
            PokemonSprites = new List<SpriteWrapperDto<PokemonSpritesDto>>
            {
                new SpriteWrapperDto<PokemonSpritesDto>()
            };
            Stats = new List<PokemonStatDto>();
        }
    }
}
