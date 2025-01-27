using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Web.Virtualization;
using Microsoft.JSInterop;
using Pokedex.Model;
using Pokedex.Service.Interface;
using Pokedex.Extensions;
using System.Collections.Generic;
using Pokedex.Constants;
using Pokedex.Utilities;
using Microsoft.Extensions.Options;

namespace Pokedex.Components.Pages
{
    public partial class DexOverview : ComponentBase, IDisposable
    {
        [Inject] private IOptions<ApiPaths> ApiPaths { get; set; }
        [Inject] private IPokemonService PokemonService { get; set; }
        [Inject] private IItemService ItemService { get; set; }
        [Inject] private IJSRuntime JSRuntime { get; set; }
        private DotNetObjectReference<DexOverview> _dotNetHelper;
        private List<GraphQLPokemonSpeciesDTO> PokemonSpecies { get; set; } = new();
        private List<GraphQLPokemonSpeciesDTO> FilteredPokemonSpecies { get; set; } = new();
        private Timer debounceTimer;
        private string searchQuery = string.Empty;
        private List<ItemGraphQLDto> Pokeballs { get; set; } = new();
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
        public GraphQLPokemonSpeciesDTO loadingSpecies = new GraphQLPokemonSpeciesDTO();

        protected override async Task OnInitializedAsync()
        {
            isLoading = true;
            FilteredPokemonSpecies = (await PokemonService.GetPokemonSpeciesByPrefix(string.Empty)).PokemonSpecies;
            isLoading = false;
            Test();
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

        public string GetOfficialArtwork(int id)
        {
            return string.Format(ApiPaths.Value.PokemonOfficialArtworkTemplate, id);
        }

        private async Task InitializeJavaScriptListeners()
        {
            _dotNetHelper = DotNetObjectReference.Create(this);

            await JSRuntime.InvokeVoidAsync("addScrollListener", _dotNetHelper, ".content", 1000);
            await JSRuntime.InvokeVoidAsync("startPokeballAnimation", Pokeballs);
            await JSRuntime.InvokeVoidAsync("initializeClickOutsideHandler", searchContainerRef, DotNetObjectReference.Create(this));
        }

        public async void Test()
        {
            var speciesResponse = await PokemonService.GetPokemonSpeciesPaginatedGraphQL(10, 0);

            // Example: Accessing results
            foreach (var species in speciesResponse.PokemonSpecies)
            {
                Console.WriteLine($"Species ID: {species.Id}, Name: {species.SpeciesNames.FirstOrDefault()?.Name}");
            }
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

            var response = await PokemonService.GetPokemonSpeciesPaginatedGraphQL(pageSize, offset);

            count = response.Aggregate.Aggregate.Count;
            StateHasChanged();
            // Create rows with unique RowId and grouped Pokémon species
            var rows = response.PokemonSpecies
                // Assuming each Pokémon has a unique Id
                .Select((pokemon, index) => new { pokemon, RowId = (index + offset) / 6 })
                .GroupBy(x => x.RowId)
                .Select(g => new SpeciesRowDto
                {
                    RowId = g.Key,
                    PokemonSpecies = g.Select(x => x.pokemon).ToList()
                })
                .ToList();

            int totalRowCount = (int)Math.Ceiling((double)response.Aggregate.Aggregate.Count / 6);

            return new ItemsProviderResult<SpeciesRowDto>(rows, totalRowCount);
        }




        private async Task LoadPokeballsAsync()
        {
            Pokeballs = (await ItemService.GetAllPokeBallsAsync()).Items.ToList();
        }

        private async Task ScrollToTopAsync()
        {
            await JSRuntime.InvokeVoidAsync("scrollToTop", ".content");
        }

        private void HandleSearchChange(ChangeEventArgs e)
        {
            searchQuery = e.Value?.ToString() ?? string.Empty;

            // Cancel the previous cancellation token and create a new one
            _cancellationTokenSource?.Cancel();
            _cancellationTokenSource?.Dispose(); // Dispose of old token source
            _cancellationTokenSource = new CancellationTokenSource();

            // Clear filtered results for immediate UI feedback
            FilteredPokemonSpecies.Clear();
            StateHasChanged();

            // Debounce logic using Task.Delay
            debounceTimer?.Dispose(); // Cancel any previous debounce timer
            debounceTimer = new Timer(async _ =>
            {
                await InvokeAsync(() => FilterPokemonSpeciesAsync(_cancellationTokenSource.Token));
            }, null, 200, Timeout.Infinite); // 300ms debounce delay
        }

        private async Task FilterPokemonSpeciesAsync(CancellationToken cancellationToken)
        {
            try
            {
                var response = await PokemonService.GetPokemonSpeciesByPrefix(searchQuery)
                                                   .WithCancellation(cancellationToken);
                FilteredPokemonSpecies = response.PokemonSpecies.ToList();
            }
            catch (OperationCanceledException)
            {
                // Ignore cancellation errors
            }
            finally
            {
                StateHasChanged();
            }
        }

        private void SelectPokemon(string name)
        {
            selectedPokemon = name;
            showDropdown = false;
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