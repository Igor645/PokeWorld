using AutoMapper;
using Pokedex.Model;
using Pokedex.Service.Interface;
using System.Text.Json;
using Newtonsoft.Json.Linq;
using Pokedex.Constants;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;
using Pokedex.Utilities;
using System.Threading.Tasks.Dataflow;

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

        public async Task<PokeApiResponseDto<PokemonSpeciesDto>> GetPokemonSpeciesPaginated(int limit, int offset)
        {
            // Build the endpoint URL
            string endpoint = TemplateProcessor.ProcessEndpointTemplate(_apiPaths.PokemonSpecies, new { limit, offset });

            // Fetch the paginated species list
            var response = await _httpClient.GetAsync(endpoint);
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            var speciesList = JsonConvert.DeserializeObject<PokeApiResponseDto<EndpointLookupDto>>(jsonResponse);

            // Use FetchSpeciesDetailsAsync to get detailed species info
            var detailedSpecies = await FetchSpeciesDetailsAsync(speciesList.Results);

            // Return the response with detailed species
            return new PokeApiResponseDto<PokemonSpeciesDto>
            {
                Count = speciesList.Count,
                Next = speciesList.Next,
                Previous = speciesList.Previous,
                Results = detailedSpecies.OrderBy(pokemon => pokemon.Id).ToList() // Ensure results are ordered
            };
        }


        public async Task<List<PokemonSpeciesDto>> GetPokemonSpeciesByPrefix(string prefix)
        {
            if (string.IsNullOrWhiteSpace(prefix))
            {
                // Fetch the first 15 species when no prefix is provided
                return await GetFirstNSpeciesAsync(15);
            }

            const int batchSize = 50; // Reduced batch size for more efficient API calls
            int offset = 0;           // Start from the first entry
            var detailedSpecies = new List<PokemonSpeciesDto>();

            while (detailedSpecies.Count < 15)
            {
                string endpoint = TemplateProcessor.ProcessEndpointTemplate(
                    _apiPaths.PokemonSpecies,
                    new { limit = batchSize, offset }
                );

                // Fetch a batch of Pokémon species
                var response = await _httpClient.GetAsync(endpoint);
                response.EnsureSuccessStatusCode();

                var jsonResponse = await response.Content.ReadAsStringAsync();
                var speciesList = JsonConvert.DeserializeObject<PokeApiResponseDto<EndpointLookupDto>>(jsonResponse);

                // Filter matching species by prefix
                var filteredSpecies = speciesList.Results
                    .Where(s => s.Name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                    .ToList();

                // Stop if no more matching species and no further pages
                if (!filteredSpecies.Any() && string.IsNullOrEmpty(speciesList.Next))
                {
                    break;
                }

                // Fetch details for filtered species concurrently
                var speciesDetails = await FetchSpeciesDetailsAsync(filteredSpecies.Take(15 - detailedSpecies.Count));
                detailedSpecies.AddRange(speciesDetails);

                // Stop early if we already have 15 species
                if (detailedSpecies.Count >= 15)
                {
                    break;
                }

                offset += batchSize; // Move to the next batch
            }

            return detailedSpecies;
        }


        private async Task<List<PokemonSpeciesDto>> GetFirstNSpeciesAsync(int count)
        {
            string endpoint = TemplateProcessor.ProcessEndpointTemplate(
                _apiPaths.PokemonSpecies,
                new { limit = count, offset = 0 }
            );

            var response = await _httpClient.GetAsync(endpoint);
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            var speciesList = JsonConvert.DeserializeObject<PokeApiResponseDto<EndpointLookupDto>>(jsonResponse);

            return await FetchSpeciesDetailsAsync(speciesList.Results.Take(count));
        }

        private async Task<List<PokemonSpeciesDto>> FetchSpeciesDetailsAsync(IEnumerable<EndpointLookupDto> speciesList)
        {
            var fetchTasks = speciesList.Select(async species =>
            {
                var detailResponse = await _httpClient.GetAsync(species.Url);
                detailResponse.EnsureSuccessStatusCode();

                var detailJson = await detailResponse.Content.ReadAsStringAsync();
                return JsonConvert.DeserializeObject<PokemonSpeciesDto>(detailJson);
            });

            List<PokemonSpeciesDto?> list = (await Task.WhenAll(fetchTasks)).ToList();
            return list;
        }


    }
}
