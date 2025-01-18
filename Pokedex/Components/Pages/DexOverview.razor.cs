using Microsoft.AspNetCore.Components;
using Pokedex.Model;
using Pokedex.Service.Interface;
using System.Collections.Generic;

namespace Pokedex.Components.Pages
{
    public partial class DexOverview : ComponentBase
    {
        [Inject]
        public IPokemonService PokemonService { get; set; }
        private List<PokemonSpeciesDto> PokemonSpecies { get; set; } = new List<PokemonSpeciesDto>();

        public bool isLoading { get; set; } = true;
        private int currentPage = 1;
        private int limit = 1105;
        private int offset => (currentPage - 1) * limit;

        protected override async Task OnInitializedAsync()
        {
            await FetchPokemons();
        }

        private async Task FetchPokemons()
        {
            isLoading = true;
            var paginatedPokemons = await PokemonService.GetPokemonSpeciesPaginated(limit, offset);
            PokemonSpecies = paginatedPokemons.ToList();
            isLoading = false;
        }
    }
}
