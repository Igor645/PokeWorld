using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class PokemonSpeciesDTO
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; }

        [JsonPropertyName("pokemon_v2_pokemons")]
        public List<PokemonDto> Pokemons { get; set; }

        [JsonPropertyName("pokemon_v2_pokemonspeciesnames")]
        public List<SpeciesNameDto> SpeciesNames { get; set; }

        [JsonPropertyName("pokemon_v2_generation")]
        public GenerationDto Generation { get; set; }

        public PokemonSpeciesDTO()
        {
            Id = 0;
            Pokemons = new List<PokemonDto>
            {
                new PokemonDto()
            };
        }
    }
}
