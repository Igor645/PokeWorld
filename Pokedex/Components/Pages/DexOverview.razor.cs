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
        private DotNetObjectReference<DexOverview> _dotNetHelper;
        private List<PokemonSpeciesDto> PokemonSpecies { get; set; } = new();
        private bool isLoading = false;
        private bool allDataLoaded = false;
        private int currentPage = 1;
        private const int Limit = 30;
        private int Offset => (currentPage - 1) * Limit;
        private bool showScrollToTop = false;

        protected override async Task OnInitializedAsync()
        {
            await FetchPokemons();
        }

        protected override async Task OnAfterRenderAsync(bool firstRender)
        {
            if (firstRender)
            {
                _dotNetHelper = DotNetObjectReference.Create(this);

                // Add listener for "Scroll to Top" logic
                await JSRuntime.InvokeVoidAsync("addScrollListener", _dotNetHelper, ".content");

                // Add listener for infinite scrolling
                await JSRuntime.InvokeVoidAsync("addSmoothScrollListener", ".content", _dotNetHelper, 100);
            }
        }

        [JSInvokable("HandleScrollChanged")]
        public void OnScrollChanged(int scrollPosition, bool showButton)
        {
            if (showScrollToTop != showButton)
            {
                showScrollToTop = showButton;
                StateHasChanged();
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

        private async Task ScrollToTop()
        {
            await JSRuntime.InvokeVoidAsync("scrollToTop", ".content");
        }

        public void Dispose()
        {
            _dotNetHelper?.Dispose();
        }

    }
}
