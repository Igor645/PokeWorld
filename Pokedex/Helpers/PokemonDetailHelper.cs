using Pokedex.Model;

namespace Pokedex.Helpers
{
    public class PokemonDetailHelper
    {
        public static string GetPokemonImage(PokemonDto pokemon)
        {
            return pokemon?.PokemonSprites?.FirstOrDefault()?.Sprites?.Other?.OfficialArtwork?.FrontDefault;
        }
    }
}
