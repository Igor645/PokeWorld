using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class PokemonSpeciesDto
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("pokemon_v2_pokemons")]
        public List<PokemonDto> Pokemons { get; set; }

        [JsonPropertyName("pokemon_v2_pokemonspeciesnames")]
        public List<SpeciesNameDto> SpeciesNames { get; set; }

        [JsonPropertyName("pokemon_v2_generation")]
        public GenerationDto Generation { get; set; }

        [JsonPropertyName("pokemon_v2_pokemonsprites")]
        public PokemonSpritesDto? Sprites { get; set; }

        [JsonPropertyName("pokemon_v2_pokemonspeciesflavortexts")]
        public List<FlavorTextDto> FlavorTexts { get; set; }

        public PokemonSpeciesDto()
        {
            Id = 0;
            Name = string.Empty;
            Pokemons = new List<PokemonDto>();
            SpeciesNames = new List<SpeciesNameDto>();
            Generation = new GenerationDto();
            Sprites = null;
        }
    }
}
