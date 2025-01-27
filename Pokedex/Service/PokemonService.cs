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

        public async Task<PokemonSpeciesResponseDto> GetPokemonSpeciesPaginatedGraphQL(int limit, int offset)
        {
            string query = @"
    query PokemonSpeciesOverview($limit: Int, $offset: Int) {
      pokemon_v2_pokemonspecies(limit: $limit, offset: $offset, order_by: {id: asc}) {
        pokemon_v2_pokemons(where: {is_default: {_eq: true}}) {
          id
          pokemon_v2_pokemonsprites {
            sprites
          }
        }
        id
        pokemon_v2_pokemonspeciesnames(where: {pokemon_v2_language: {name: {_eq: ""en""}}}) {
          name
          pokemon_v2_language {
            name
          }
        }
        pokemon_v2_generation {
          name
        }
      }
      pokemon_v2_pokemonspecies_aggregate {
        aggregate {
          count
        }
      }
    }";

            var variables = new
            {
                limit,
                offset
            };

            var response = await _graphQLService.ExecuteQueryAsync<PokemonSpeciesResponseDto>(query, variables);

            await Task.Delay(100);

            return response;
        }


        public async Task<PokemonSpeciesResponseDto> GetPokemonSpeciesByPrefix(string prefix)
        {
            bool isPrefixEmpty = string.IsNullOrWhiteSpace(prefix);

            string query = isPrefixEmpty
                ? @"
query MyQuery {
    pokemon_v2_pokemonspecies(order_by: {id: asc}, limit: 15) {
        id
        name
        pokemon_v2_pokemons {
            pokemon_v2_pokemonsprites {
                sprites
            }
        }
    }
}"
                : @"
query MyQuery($search: String) {
    pokemon_v2_pokemonspecies(where: {name: {_ilike: $search}}, order_by: {id: asc}) {
        id
        name
        pokemon_v2_pokemons {
            pokemon_v2_pokemonsprites {
                sprites
            }
        }
    }
}";

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
