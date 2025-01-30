using Pokedex.Model;

namespace Pokedex.Extensions
{
    public static class PokemonExtensions
    {
        public static string GetPokemonImage(this PokemonDto pokemon)
        {
            return pokemon?.PokemonSprites?.FirstOrDefault()?.Sprites?.Other?.OfficialArtwork?.FrontDefault;
        }

        public static string GetPokemonSpeciesNameByLanguage(this PokemonSpeciesDto pokemonSpecies, string language)
        {
            return pokemonSpecies?.SpeciesNames?.FirstOrDefault(x => x.Language.Name == language)?.Name;
        }

        public static string GetPokemonSpeciesDexEntryByLanguageAndVersion(this PokemonSpeciesDto pokemonSpecies, string language, string version)
        {
            var isNoVersionCheck = string.IsNullOrWhiteSpace(version);
            var flavortext = pokemonSpecies?.FlavorTexts?
                .FirstOrDefault(x => x.Language.Name == language && 
                                (isNoVersionCheck || x.Version.Name == version))?.FlavorText;
            return flavortext.Replace("\f", " ");
        }
    }
}
