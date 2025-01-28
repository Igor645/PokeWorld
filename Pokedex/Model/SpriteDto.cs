using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class SpriteDto
    {
        [JsonPropertyName("front_default")]
        public string FrontDefault { get; set; }

        [JsonPropertyName("front_shiny")]
        public string FrontShiny { get; set; }

        [JsonPropertyName("front_female")]
        public string FrontFemale { get; set; }

        [JsonPropertyName("front_shiny_female")]
        public string FrontShinyFemale { get; set; }

        [JsonPropertyName("back_default")]
        public string BackDefault { get; set; }

        [JsonPropertyName("back_shiny")]
        public string BackShiny { get; set; }

        [JsonPropertyName("back_female")]
        public string BackFemale { get; set; }

        [JsonPropertyName("back_shiny_female")]
        public string BackShinyFemale { get; set; }

        public SpriteDto()
        {
            FrontDefault = "/images/invalid-image.jpg";
        }
    }
}
