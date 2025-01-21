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
            string endpoint = TemplateProcessor.ProcessEndpointTemplate(_apiPaths.PokemonSpecies, new { limit, offset });

            var response = await _httpClient.GetAsync(endpoint);
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            var speciesList = JsonConvert.DeserializeObject<PokeApiResponseDto<EndpointLookupDto>>(jsonResponse);

            var detailedSpecies = new List<PokemonSpeciesDto>();

            var block = new ActionBlock<EndpointLookupDto>(
                async species =>
                {
                    var detailResponse = await _httpClient.GetAsync(species.Url);
                    detailResponse.EnsureSuccessStatusCode();

                    var detailJson = await detailResponse.Content.ReadAsStringAsync();
                    var speciesDetail = JsonConvert.DeserializeObject<PokemonSpeciesDto>(detailJson);

                    lock (detailedSpecies)
                    {
                        detailedSpecies.Add(speciesDetail);
                    }
                },
                new ExecutionDataflowBlockOptions
                {
                    MaxDegreeOfParallelism = 10 // Adjust based on your system capacity
                });

            foreach (var species in speciesList.Results)
            {
                block.Post(species);
            }

            block.Complete();
            await block.Completion;

            return new PokeApiResponseDto<PokemonSpeciesDto>
            {
                Count = speciesList.Count,
                Next = speciesList.Next,
                Previous = speciesList.Previous,
                Results = detailedSpecies
            };
        }

        public async Task<List<PokemonSpeciesDto>> GetPokemonSpeciesByPrefix(string prefix)
        {
            const int batchSize = 100; // Number of species to fetch per request
            int offset = 0;           // Start from the first entry
            int matchCount = 0;       // Count of matching species
            var detailedSpecies = new List<PokemonSpeciesDto>();

            while (matchCount < 15)
            {
                string endpoint = TemplateProcessor.ProcessEndpointTemplate(_apiPaths.PokemonSpecies, new { limit = batchSize, offset });

                var response = await _httpClient.GetAsync(endpoint);
                response.EnsureSuccessStatusCode();

                var jsonResponse = await response.Content.ReadAsStringAsync();
                var speciesList = JsonConvert.DeserializeObject<PokeApiResponseDto<EndpointLookupDto>>(jsonResponse);

                // Filter matching species by prefix
                var filteredSpecies = speciesList.Results
                    .Where(s => s.Name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                    .ToList();

                // Fetch details for filtered species
                foreach (var species in filteredSpecies)
                {
                    if (matchCount >= 15) break;

                    var detailResponse = await _httpClient.GetAsync(species.Url);
                    detailResponse.EnsureSuccessStatusCode();

                    var detailJson = await detailResponse.Content.ReadAsStringAsync();
                    var speciesDetail = JsonConvert.DeserializeObject<PokemonSpeciesDto>(detailJson);

                    detailedSpecies.Add(speciesDetail);
                    matchCount++;
                }

                // Stop if we've reached the last page
                if (string.IsNullOrEmpty(speciesList.Next))
                {
                    break;
                }

                // Move to the next batch
                offset += batchSize;
            }

            return detailedSpecies;
        }

    }
}
