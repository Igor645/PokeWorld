namespace Pokedex.Constants
{
    public static class GraphQLQueries
    {
        public const string GetPokemonDetails = @"
        query PokemonDetails($value: {TYPE}) {
          pokemon_v2_pokemonspecies(
            where: { {FILTER} }
          ) {
            id
            name
            pokemon_v2_pokemons {
              id
              name
              is_default
              pokemon_v2_pokemonsprites {
                sprites
              }
              pokemon_v2_pokemonstats {
                base_stat
                effort
                pokemon_v2_stat {
                  id
                  name
                }
              }
            }
            name
            pokemon_v2_pokemonspeciesnames {
                name
                pokemon_v2_language {
                name
                id
                }
            }
            pokemon_v2_pokemonspeciesflavortexts {
              flavor_text
              id
              pokemon_v2_language {
                name
                id
              }
              pokemon_v2_version {
                name
                id
              }
            }
          }
        }";

        public const string GetPokemonSpeciesPaginated = @"
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

        public const string GetPokemonSpeciesByPrefix = @"
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

        public const string GetPokemonSpeciesWithoutPrefix = @"
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
        }";
    }
}
