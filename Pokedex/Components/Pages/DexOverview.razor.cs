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
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Pokedex.Components.Pages
{
    public partial class DexOverview : ComponentBase, IDisposable
    {
        [Inject] private IOptions<ApiPaths> ApiPaths { get; set; }
        [Inject] private IPokemonService PokemonService { get; set; }
        [Inject] private IItemService ItemService { get; set; }
        [Inject] private IJSRuntime JSRuntime { get; set; }
        [Inject] private NavigationManager NavigationManager { get; set; } = default!;

        private DotNetObjectReference<DexOverview> _dotNetHelper;
        private List<PokemonSpeciesDTO> PokemonSpecies { get; set; } = new();
        private List<PokemonSpeciesDTO> FilteredPokemonSpecies { get; set; } = new();
        private Timer debounceTimer;
        private string searchQuery = string.Empty;
        private bool isLoading;
        private int count;
        private bool showDropdown;
        private ElementReference searchContainerRef;
        private CancellationTokenSource _cancellationTokenSource;
        private bool showScrollToTopButton;
        private bool listenersInitialized;
        private PokemonSpeciesDTO loadingSpecies = new();

        protected override async Task OnInitializedAsync()
        {
            isLoading = true;
            FilteredPokemonSpecies = (await PokemonService.GetPokemonSpeciesByPrefix(string.Empty)).PokemonSpecies;
            isLoading = false;
        }

        protected override async Task OnAfterRenderAsync(bool firstRender)
        {
            if (firstRender && !listenersInitialized)
            {
                await InitializeJavaScriptListeners();
                listenersInitialized = true;
            }
        }

        public string GetOfficialArtwork(int id) => string.Format(ApiPaths.Value.PokemonOfficialArtworkTemplate, id);

        private async Task InitializeJavaScriptListeners()
        {
            _dotNetHelper = DotNetObjectReference.Create(this);
            await JSRuntime.InvokeVoidAsync("addScrollListener", _dotNetHelper, ".content", 1000);
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
            int offset = request.StartIndex * 6;
            int pageSize = request.Count * 6;

            var response = await PokemonService.GetPokemonSpeciesPaginatedGraphQL(pageSize, offset);
            count = response.Aggregate.Aggregate.Count;
            StateHasChanged();
            var rows = response.PokemonSpecies
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

        private async Task ScrollToTopAsync()
        {
            await JSRuntime.InvokeVoidAsync("scrollToTop", ".content");
        }

        private void HandleSearchChange(ChangeEventArgs e)
        {
            searchQuery = e.Value?.ToString() ?? string.Empty;

            _cancellationTokenSource?.Cancel();
            _cancellationTokenSource?.Dispose();
            _cancellationTokenSource = new CancellationTokenSource();

            FilteredPokemonSpecies.Clear();
            StateHasChanged();

            debounceTimer?.Dispose();
            debounceTimer = new Timer(async _ =>
            {
                await InvokeAsync(() => FilterPokemonSpeciesAsync(_cancellationTokenSource.Token));
            }, null, 200, Timeout.Infinite);
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

        private void SelectPokemon(int id)
        {
            NavigationManager.NavigateTo($"/pokemon/{id}");
            showDropdown = false;
        }

        private void ShowDropdown() => showDropdown = true;

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