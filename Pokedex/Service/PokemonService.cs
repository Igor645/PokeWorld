using AutoMapper;
using Pokedex.Model;
using Pokedex.Service.Interface;
using System.Text.Json;
using Newtonsoft.Json.Linq;
using Pokedex.Constants;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;
using Pokedex.Utilities;
namespace Pokedex.Service
{
    public class PokemonService : IPokemonService
    {
        private readonly HttpClient _httpClient;
        private readonly ApiPaths _apiPaths;

        private JsonSerializerOptions options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };
        public PokemonService(HttpClient httpClient, IOptions<ApiPaths> apiPaths)
        {
            _httpClient = httpClient;
            _apiPaths = apiPaths.Value;
        }

        public async Task<IEnumerable<PokemonSpeciesDto>> GetPokemonSpeciesPaginated(int limit, int offset)
        {
            // Step 1: Get the paginated species list
            string endpoint = TemplateProcessor.ProcessEndpointTemplate(_apiPaths.PokemonSpecies, new { limit, offset });

            var response = await _httpClient.GetAsync(endpoint);
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            var speciesList = JsonConvert.DeserializeObject<PokeApiResponseDto<EndpointLookupDto>>(jsonResponse);

            // Step 2: Fetch details for each species in parallel
            var tasks = speciesList.Results.Select(async species =>
            {
                var detailResponse = await _httpClient.GetAsync(species.Url);
                detailResponse.EnsureSuccessStatusCode();

                var detailJson = await detailResponse.Content.ReadAsStringAsync();
                return JsonConvert.DeserializeObject<PokemonSpeciesDto>(detailJson);
            });

            // Step 3: Wait for all tasks to complete and return the results
            var detailedSpecies = await Task.WhenAll(tasks);
            return detailedSpecies;
        }

    }
}
