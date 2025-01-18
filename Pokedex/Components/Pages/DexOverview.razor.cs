using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;
using Pokedex.Model;
using Pokedex.Service.Interface;
using System.Collections.Generic;

namespace Pokedex.Components.Pages
{
    public partial class DexOverview : ComponentBase
    {
        [Inject] private IPokemonService PokemonService { get; set; }
        [Inject] private IJSRuntime JSRuntime { get; set; }

        private List<PokemonSpeciesDto> PokemonSpecies { get; set; } = new();
        private bool isLoading = false;
        private bool allDataLoaded = false;
        private int currentPage = 1;
        private const int Limit = 30; // Number of Pokémon to fetch per page
        private int Offset => (currentPage - 1) * Limit;

        protected override async Task OnInitializedAsync()
        {
            await FetchPokemons();
        }

        protected override async Task OnAfterRenderAsync(bool firstRender)
        {
            if (firstRender)
            {
                await JSRuntime.InvokeVoidAsync("addSmoothScrollListener", ".content",
                    DotNetObjectReference.Create(this), 100);
            }
        }

        [JSInvokable]
        public async Task OnScrollReachedBottom()
        {
            if (!isLoading && !allDataLoaded)
            {
                await FetchPokemons();
            }
        }

        private async Task FetchPokemons()
        {
            if (isLoading || allDataLoaded) return;

            isLoading = true;

            var paginatedPokemons = await PokemonService.GetPokemonSpeciesPaginated(Limit, Offset);
            if (paginatedPokemons?.Any() == true)
            {
                PokemonSpecies.AddRange(paginatedPokemons);
                currentPage++;
            }
            else
            {
                allDataLoaded = true;
            }

            isLoading = false;
            StateHasChanged();
        }
    }
}
