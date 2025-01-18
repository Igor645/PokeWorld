using Microsoft.AspNetCore.Components;
using Microsoft.Extensions.Options;
using Pokedex.Constants;
using Pokedex.Model;
using Pokedex.Utilities;

namespace Pokedex.Components.UI
{
    public partial class PokemonCard : ComponentBase
    {
        [Parameter]
        public PokemonSpeciesDto PokemonSpecies { get; set; }

        [Inject]
        private IOptions<ApiPaths> ApiPaths { get; set; }

        public string GetOfficialArtwork(int id)
        {
            return string.Format(ApiPaths.Value.PokemonOfficialArtworkTemplate, id);
        }
        public static string ParseGenerationName(string generation)
        {
            if (string.IsNullOrWhiteSpace(generation))
                return string.Empty;

            // Split by '-' and capitalize the second part (roman numeral)
            var parts = generation.Split('-');
            if (parts.Length != 2)
                return generation; // Return the original string if it's not in the expected format

            string romanNumeral = parts[1].ToUpper(); // Convert 'i', 'ii', etc., to uppercase
            return $"Generation {romanNumeral}";
        }
    }
}
