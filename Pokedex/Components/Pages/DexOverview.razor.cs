using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Web.Virtualization;
using Microsoft.JSInterop;
using Pokedex.Model;
using Pokedex.Service.Interface;
using Pokedex.Extensions;
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
        private List<PokemonSpeciesDto> FilteredPokemonSpecies { get; set; } = new();
        private Timer debounceTimer;
        private string searchQuery = string.Empty;
        private List<ItemDto> Pokeballs { get; set; } = new();
        private bool isLoading = false;
        private bool allDataLoaded = false;
        private int currentPage = 1;
        private const int PageSize = 30;
        private int count = 0;
        private string selectedPokemon = string.Empty;
        private bool showDropdown = false;
        private ElementReference searchContainerRef;
        private CancellationTokenSource _cancellationTokenSource;

        private int Offset => (currentPage - 1) * PageSize;
        private bool showScrollToTopButton = false;
        private bool listenersInitialized = false;
        public PokemonSpeciesDto loadingSpecies = new PokemonSpeciesDto
        {
            Id = 0,
        };

        protected override async Task OnInitializedAsync()
        {
            isLoading = true;
            FilteredPokemonSpecies = (await PokemonService.GetPokemonSpeciesPaginated(15, 0)).Results;
            isLoading = false;
        }


        protected override async Task OnAfterRenderAsync(bool firstRender)
        {
            if (firstRender && !listenersInitialized)
            {
                await LoadPokeballsAsync();
                await InitializeJavaScriptListeners();
                listenersInitialized = true;
            }
        }

        private async Task InitializeJavaScriptListeners()
        {
            _dotNetHelper = DotNetObjectReference.Create(this);

            await JSRuntime.InvokeVoidAsync("addScrollListener", _dotNetHelper, ".content", 1000);
            await JSRuntime.InvokeVoidAsync("startPokeballAnimation", Pokeballs);
            await JSRuntime.InvokeVoidAsync("initializeClickOutsideHandler", searchContainerRef, DotNetObjectReference.Create(this));
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

        private async ValueTask<ItemsProviderResult<SpeciesRowDto>> LoadPokemonSpeciesAsync(ItemsProviderRequest request)
        {
            int offset = request.StartIndex * 6; // Start index for pagination
            int pageSize = request.Count * 6;   // Fetch enough items for `Count` rows, each row having 6 Pokémon

            var response = await PokemonService.GetPokemonSpeciesPaginated(pageSize, offset);

            count = response.Count;
            StateHasChanged();
            // Create rows with unique RowId and grouped Pokémon species
            var rows = response.Results
                .OrderBy(pokemon => pokemon.Id) // Assuming each Pokémon has a unique Id
                .Select((pokemon, index) => new { pokemon, RowId = (index + offset) / 6 })
                .GroupBy(x => x.RowId)
                .Select(g => new SpeciesRowDto
                {
                    RowId = g.Key,
                    PokemonSpecies = g.Select(x => x.pokemon).ToList()
                })
                .ToList();

            int totalRowCount = (int)Math.Ceiling((double)response.Count / 6);

            return new ItemsProviderResult<SpeciesRowDto>(rows, totalRowCount);
        }




        private async Task LoadPokeballsAsync()
        {
            Pokeballs = (await ItemService.GetAllPokeBallsAsync()).ToList();
        }

        private async Task ScrollToTopAsync()
        {
            await JSRuntime.InvokeVoidAsync("scrollToTop", ".content");
        }

        private void HandleSearchChange(ChangeEventArgs e)
        {
            searchQuery = e.Value?.ToString() ?? string.Empty;

            // Cancel any ongoing fetch and create a new CancellationTokenSource
            _cancellationTokenSource?.Cancel();
            _cancellationTokenSource = new CancellationTokenSource();

            // Debounce logic
            debounceTimer?.Dispose(); // Cancel previous timer if any
            debounceTimer = new Timer(async _ =>
            {
                await InvokeAsync(() => FilterPokemonSpecies(_cancellationTokenSource.Token));
            }, null, 300, Timeout.Infinite); // 300ms debounce delay
        }

        private async Task FilterPokemonSpecies(CancellationToken cancellationToken)
        {
            isLoading = true;

            try
            {
                if (string.IsNullOrWhiteSpace(searchQuery))
                {
                    FilteredPokemonSpecies = PokemonSpecies.Take(15).ToList(); // Default to first 15 if no query
                }
                else
                {
                    var response = await PokemonService.GetPokemonSpeciesByPrefix(searchQuery)
                                                       .WithCancellation(cancellationToken);
                    FilteredPokemonSpecies = response.Take(15).ToList(); // Limit to first 15 results
                }
            }
            catch (OperationCanceledException)
            {
                // Fetch operation was canceled, no need to do anything
            }
            finally
            {
                isLoading = false;
                StateHasChanged();
            }
        }

        private void SelectPokemon(string name)
        {
            selectedPokemon = name;
            showDropdown = false; // Close the dropdown after selection
        }

        private void ShowDropdown()
        {
            showDropdown = true;
        }

        [JSInvokable("HideDropdown")]
        public void HideDropdown()
        {
            showDropdown = false;
            StateHasChanged();
        }


        public void Dispose()
        {
            debounceTimer?.Dispose();
            _dotNetHelper?.Dispose();
        }
    }
}