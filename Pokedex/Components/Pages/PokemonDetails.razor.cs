using Microsoft.AspNetCore.Components;
using Pokedex.Model;
using Pokedex.Service;
using Pokedex.Service.Interface;

namespace Pokedex.Components.Pages
{
    public partial class PokemonDetails : ComponentBase
    {
        [Parameter] public int? SpeciesId { get; set; }
        [Parameter] public string? SpeciesName { get; set; }

        [Inject] private IPokemonService PokemonService { get; set; } = null!;
        [Inject] private NavigationManager NavigationManager { get; set; } = null!;

        private PokemonSpeciesDto? pokemonSpeciesDetails;
        private PokemonDto? selectedPokemon;

        protected override async Task OnInitializedAsync()
        {
            if (SpeciesId.HasValue)
            {
                pokemonSpeciesDetails = (await PokemonService.GetPokemonDetailsGraphQL(id: SpeciesId.Value)).PokemonSpecies.FirstOrDefault();
            }
            else if (!string.IsNullOrWhiteSpace(SpeciesName))
            {
                pokemonSpeciesDetails = (await PokemonService.GetPokemonDetailsGraphQL(name: SpeciesName)).PokemonSpecies.FirstOrDefault();
            }
            else
            {
                NavigationManager.NavigateTo("/");
            }

            selectedPokemon = pokemonSpeciesDetails?.Pokemons.First(x => x.IsDefault = true);
            var test = @pokemonSpeciesDetails.FlavorTexts.Where(x => x.Language.Name == "de" && x.Version.Name == "sun");
        }

        private string GetPokemonImage(PokemonDto pokemon)
        {
            return pokemon?.PokemonSprites?.FirstOrDefault()?.Sprites?.Other?.OfficialArtwork?.FrontDefault;
        }
    }
}
