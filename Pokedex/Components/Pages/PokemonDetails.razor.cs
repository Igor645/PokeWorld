using Microsoft.AspNetCore.Components;

namespace Pokedex.Components.Pages
{
    public partial class PokemonDetails : ComponentBase
    {
        [Parameter]
        public int SpeciesId { get; set; }

        private Pokemon? pokemonDetails;

        protected override async Task OnInitializedAsync()
        {
            try
            {
                pokemonDetails = await GetPokemonDetails(SpeciesId);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to fetch Pokémon details: {ex.Message}");
                NavigationManager.NavigateTo("/"); // Redirect if something goes wrong
            }
        }

        private Task<Pokemon> GetPokemonDetails(int speciesId)
        {
            var mockData = new Dictionary<int, Pokemon>
        {
            { 1, new Pokemon { Id = 1, Name = "Bulbasaur", Types = new[] { "Grass", "Poison" }, Description = "A seed Pokémon.", ImageUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png" } },
            { 2, new Pokemon { Id = 2, Name = "Ivysaur", Types = new[] { "Grass", "Poison" }, Description = "A stage 2 seed Pokémon.", ImageUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/2.png" } },
            { 3, new Pokemon { Id = 3, Name = "Venusaur", Types = new[] { "Grass", "Poison" }, Description = "A fully evolved seed Pokémon.", ImageUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/3.png" } }
        };

            if (mockData.ContainsKey(speciesId))
            {
                return Task.FromResult(mockData[speciesId]);
            }
            else
            {
                throw new KeyNotFoundException($"Pokémon with SpeciesId {speciesId} not found.");
            }
        }

        public class Pokemon
        {
            public int Id { get; set; }
            public string Name { get; set; } = "";
            public string[] Types { get; set; } = Array.Empty<string>();
            public string Description { get; set; } = "";
            public string ImageUrl { get; set; } = "";
        }
    }
}
