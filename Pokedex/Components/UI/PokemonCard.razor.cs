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

            var parts = generation.Split('-');
            if (parts.Length != 2)
                return generation; 

            string romanNumeral = parts[1].ToUpper(); 
            return $"Generation {romanNumeral}";
        }
    }
}
