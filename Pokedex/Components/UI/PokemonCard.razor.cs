using Microsoft.AspNetCore.Components;
using Microsoft.Extensions.Options;
using Microsoft.JSInterop;
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
        [Inject] private IJSRuntime JSRuntime { get; set; }


        protected override async Task OnAfterRenderAsync(bool firstRender)
        {
            if (firstRender)
            {
                await JSRuntime.InvokeVoidAsync("removeInitialLoad");
            }
        }

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
