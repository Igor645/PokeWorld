using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class PokemonSpeciesResponseDto
    {
        [JsonPropertyName("pokemon_v2_pokemonspecies")]
        public List<PokemonSpeciesDTO> PokemonSpecies { get; set; }

        [JsonPropertyName("pokemon_v2_pokemonspecies_aggregate")]
        public PokemonSpeciesAggregateDto Aggregate { get; set; }
    }
}
