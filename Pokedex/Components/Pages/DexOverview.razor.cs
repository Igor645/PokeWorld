using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;
using Pokedex.Model;
using Pokedex.Service.Interface;
using System.Collections.Generic;

namespace Pokedex.Components.Pages
{
    public partial class DexOverview : ComponentBase, IDisposable
    {
        [Inject] private IPokemonService PokemonService { get; set; }
        [Inject] private IJSRuntime JSRuntime { get; set; }
        private DotNetObjectReference<DexOverview> _dotNetHelper;
        private List<PokemonSpeciesDto> PokemonSpecies { get; set; } = new();
        private bool isLoading = false;
        private bool allDataLoaded = false;
        private int currentPage = 1;
        private const int PageSize = 30;
        private int Offset => (currentPage - 1) * PageSize;
        private bool showScrollToTopButton = false;
        private bool listenersInitialized = false;

        protected override async Task OnInitializedAsync()
        {
            await LoadPokemonSpeciesAsync();
        }

        protected override async Task OnAfterRenderAsync(bool firstRender)
        {
            if (firstRender && !listenersInitialized)
            {
                InitializeJavaScriptListeners();
                listenersInitialized = true;
            }
        }

        private async void InitializeJavaScriptListeners()
        {
            _dotNetHelper = DotNetObjectReference.Create(this);

            // Add listener for "Scroll to Top" logic
            await JSRuntime.InvokeVoidAsync("addScrollListener", _dotNetHelper, ".content", 1000);

            // Add listener for infinite scrolling
            await JSRuntime.InvokeVoidAsync("addSmoothScrollListener", ".content", _dotNetHelper, 100);
        }

        [JSInvokable("HandleScrollChanged")]
        public void OnScrollChanged(int scrollPosition, bool showButton)
        {
            if (showScrollToTopButton != showButton)
            {
                showScrollToTopButton = showButton;
                StateHasChanged();
            }
        }

        [JSInvokable]
        public async Task OnScrollReachedBottom()
        {
            if (!isLoading && !allDataLoaded)
            {
                await LoadPokemonSpeciesAsync();
            }
        }

        private async Task LoadPokemonSpeciesAsync()
        {
            if (isLoading || allDataLoaded) return;

            isLoading = true;

            var paginatedPokemons = await PokemonService.GetPokemonSpeciesPaginated(PageSize, Offset);
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

        private async Task ScrollToTopAsync()
        {
            await JSRuntime.InvokeVoidAsync("scrollToTop", ".content");
        }

        public void Dispose()
        {
            _dotNetHelper?.Dispose();
        }
    }
}