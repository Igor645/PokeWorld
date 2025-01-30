using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class PokemonStatDto
    {
        [JsonPropertyName("base_stat")]
        public int BaseStat { get; set; }

        [JsonPropertyName("effort")]
        public int Effort { get; set; }

        [JsonPropertyName("pokemon_v2_stat")]
        public StatDto Stat { get; set; } = new StatDto();
    }
}
