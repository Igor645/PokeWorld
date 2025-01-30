using AutoMapper;
using Pokedex.Model;
using Pokedex.Service.Interface;
using Pokedex.Constants; // Import the queries
using Microsoft.Extensions.Options;
using Newtonsoft.Json;
using System.Text.Json;

namespace Pokedex.Service
{
    public class PokemonService : IPokemonService
    {
        private readonly HttpClient _httpClient;
        private readonly ApiPaths _apiPaths;
        private readonly GraphQLService _graphQLService;

        private JsonSerializerOptions options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };

        public PokemonService(HttpClient httpClient, GraphQLService graphQLService, IOptions<ApiPaths> apiPaths)
        {
            _httpClient = httpClient;
            _apiPaths = apiPaths.Value;
            _graphQLService = graphQLService;
        }

        public async Task<PokemonSpeciesResponseDto> GetPokemonDetailsGraphQL(int? id = null, string? name = null)
        {
            if (id == null && string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Either 'id' or 'name' must be provided.");

            string? formattedName = name != null
                ? char.ToUpper(name[0]) + name.Substring(1).ToLower()
                : null;

            string query = GraphQLQueries.GetPokemonDetails;

            string filter;
            string variableType;
            object variables;

            if (id.HasValue)
            {
                filter = "id: { _eq: $value }";
                variableType = "Int";
                variables = new { value = id.Value };
            }
            else
            {
                filter = "pokemon_v2_pokemonspeciesnames: { name: { _eq: $value } }";
                variableType = "String";
                variables = new { value = formattedName };
            }

            query = query.Replace("{FILTER}", filter).Replace("{TYPE}", variableType);

            var response = await _graphQLService.ExecuteQueryAsync<PokemonSpeciesResponseDto>(query, variables);

            return response;
        }

        public async Task<PokemonSpeciesResponseDto> GetPokemonSpeciesPaginatedGraphQL(int limit, int offset)
        {
            var query = GraphQLQueries.GetPokemonSpeciesPaginated;

            var variables = new
            {
                limit,
                offset
            };

            var response = await _graphQLService.ExecuteQueryAsync<PokemonSpeciesResponseDto>(query, variables);

            return response;
        }

        public async Task<PokemonSpeciesResponseDto> GetPokemonSpeciesByPrefix(string prefix)
        {
            bool isPrefixEmpty = string.IsNullOrWhiteSpace(prefix);
            string query = isPrefixEmpty 
                ? GraphQLQueries.GetPokemonSpeciesWithoutPrefix 
                : GraphQLQueries.GetPokemonSpeciesByPrefix;

            object? variables = isPrefixEmpty
                ? null
                : new
                {
                    search = $"{prefix}%"
                };

            var response = await _graphQLService.ExecuteQueryAsync<PokemonSpeciesResponseDto>(query, variables);

            return response;
        }
    }
}
