using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Web.Virtualization;
using Microsoft.JSInterop;
using Pokedex.Model;
using Pokedex.Service.Interface;
using System.Collections.Generic;

namespace Pokedex.Components.Pages
{
    public partial class DexOverview : ComponentBase, IDisposable
    {
        [Inject] private IPokemonService PokemonService { get; set; }
        [Inject] private IItemService ItemService { get; set; }
        [Inject] private IJSRuntime JSRuntime { get; set; }
        private DotNetObjectReference<DexOverview> _dotNetHelper;
        private List<PokemonSpeciesDto> PokemonSpecies { get; set; } = new();
        private List<ItemDto> Pokeballs { get; set; } = new();
        private bool isLoading = false;
        private bool allDataLoaded = false;
        private int currentPage = 1;
        private const int PageSize = 30;
        private int count = 0;
        private int Offset => (currentPage - 1) * PageSize;
        private bool showScrollToTopButton = false;
        private bool listenersInitialized = false;
        public PokemonSpeciesDto loadingSpecies = new PokemonSpeciesDto
        {
            Id = 0,
        };

        protected override async Task OnInitializedAsync()
        {
            //await LoadPokemonSpeciesAsync();
        }

        protected override async Task OnAfterRenderAsync(bool firstRender)
        {
            if (firstRender && !listenersInitialized)
            {
                await LoadPokeballsAsync(); // Ensure Pokeballs are loaded
                InitializeJavaScriptListeners();
                listenersInitialized = true;
            }
        }

        private async Task InitializeJavaScriptListeners()
        {
            _dotNetHelper = DotNetObjectReference.Create(this);

            //await JSRuntime.InvokeVoidAsync("addScrollListener", _dotNetHelper, ".content", 1000);
            await JSRuntime.InvokeVoidAsync("addSmoothScrollListener", ".content", _dotNetHelper, 100);
            await JSRuntime.InvokeVoidAsync("startPokeballAnimation", Pokeballs);
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

        private async ValueTask<ItemsProviderResult<List<PokemonSpeciesDto>>> LoadPokemonSpeciesAsync(ItemsProviderRequest request)
        {
            int offset = request.StartIndex * 6; // Start index for pagination
            int pageSize = request.Count * 6; // Fetch enough items for `Count` rows, each row having 6 Pokémon

            var response = await PokemonService.GetPokemonSpeciesPaginated(pageSize, offset);

            // Group the Pokémon into rows of 6 items each
            var groupedResults = response.Results
                .Select((pokemon, index) => new { pokemon, index })
                .GroupBy(x => x.index / 6) // Group by rows of 6
                .Select(g => g.Select(x => x.pokemon).ToList())
                .ToList();

            int totalRowCount = (int)Math.Ceiling((double)response.Count / 6);

            return new ItemsProviderResult<List<PokemonSpeciesDto>>(groupedResults, totalRowCount);
        }



        private async Task LoadPokeballsAsync()
        {
            Pokeballs = (await ItemService.GetAllPokeBallsAsync()).ToList();
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