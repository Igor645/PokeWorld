using Newtonsoft.Json;
using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class PokemonSpeciesResponseDto
    {
        [JsonPropertyName("pokemon_v2_pokemonspecies")]
        public List<GraphQLPokemonSpeciesDTO> PokemonSpecies { get; set; }

        [JsonPropertyName("pokemon_v2_pokemonspecies_aggregate")]
        public PokemonSpeciesAggregateDto Aggregate { get; set; }
    }

    public class GraphQLPokemonSpeciesDTO
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

        public GraphQLPokemonSpeciesDTO()
        {
            Id = 0;
            Pokemons = new List<PokemonDto>
            {
                new PokemonDto()
            };
        }
    }

    public class PokemonDto
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("pokemon_v2_pokemonsprites")]
        public List<PokemonSpriteWrapperDto> PokemonSprites { get; set; }

        // Default Constructor
        public PokemonDto()
        {
            Id = 0;
            PokemonSprites = new List<PokemonSpriteWrapperDto>
            {
                new PokemonSpriteWrapperDto()
            };
        }
    }


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


    public class PokemonSpritesDto
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

        [JsonPropertyName("other")]
        public OtherSpritesDto Other { get; set; }

        public PokemonSpritesDto()
        {
            Other = new OtherSpritesDto();
        }
    }

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

    public class FlattenedPokemonSpritesDto
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

        public FlattenedPokemonSpritesDto()
        {
            FrontDefault = "/images/invalid-image.jpg";
        }
    }

    public class SpeciesNameDto
    {
        [JsonPropertyName("name")]
        public string Name { get; set; }

        [JsonPropertyName("pokemon_v2_language")]
        public LanguageDto Language { get; set; }
    }

    public class LanguageDto
    {
        [JsonPropertyName("name")]
        public string Name { get; set; }
    }

    public class GenerationDto
    {
        [JsonPropertyName("name")]
        public string Name { get; set; }
    }

    public class PokemonSpeciesAggregateDto
    {
        [JsonPropertyName("aggregate")]
        public AggregateDto Aggregate { get; set; }
    }

    public class AggregateDto
    {
        [JsonPropertyName("count")]
        public int Count { get; set; }
    }

    // Response DTOs
    public class ItemResponseDto
    {
        [JsonPropertyName("pokemon_v2_item")]
        public List<ItemGraphQLDto> Items { get; set; }
    }

    public class ItemGraphQLDto
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; }

        [JsonPropertyName("pokemon_v2_itemsprites")]
        public List<ItemSpriteWrapperDto> ItemSprites { get; set; }
    }

    public class ItemSpriteWrapperDto
    {
        [JsonPropertyName("sprites")]
        public SpriteDto Sprites { get; set; }
    }

    public class SpriteDto
    {
        [JsonPropertyName("default")]
        public string Default { get; set; }
    }
}
