export const GraphQLQueries = {
  GetPokemonDetails: `
      query PokemonDetails($value: {TYPE}) {
        pokemon_v2_pokemonspecies(
          where: { {FILTER} }
        ) {
          id
          name
          is_legendary
          is_mythical
          is_baby
          evolution_chain_id
          evolves_from_species_id
          pokemon_v2_evolutionchain {
            pokemon_v2_pokemonspecies {
              id
              name
              evolves_from_species_id
              pokemon_v2_pokemons(where: {is_default: {_eq: true}}) {
                id
                pokemon_v2_pokemonsprites {
                  sprites
                }
              }
              pokemon_v2_pokemonspeciesnames {
                name
                pokemon_v2_language {
                  name
                  id
                }
              }
              pokemon_v2_generation {
                id
                name
                pokemon_v2_generationnames {
                  name
                  pokemon_v2_language {
                    id
                    name
                  }
                }
              }
            }
          }
          pokemon_v2_pokemons {
            id
            name
            height
            weight
            is_default
            pokemon_v2_pokemonsprites {
              sprites
            }
            pokemon_v2_pokemoncries {
              cries
            }
            pokemon_v2_pokemonstats {
              base_stat
              effort
              pokemon_v2_stat {
                id
                name
                pokemon_v2_statnames {
                  language_id
                  name
                  pokemon_v2_language {
                    id
                    name
                  }
                }
              }
            }
            pokemon_v2_pokemonforms {
              pokemon_v2_pokemonformnames {
                language_id
                name
                pokemon_v2_language {
                  id
                  name
                }
              }
            }
            pokemon_v2_pokemontypes {
              pokemon_v2_type {
                id
                name
                pokemon_v2_typenames {
                  language_id
                  name
                  pokemon_v2_language {
                    id
                    name
                  }
                }
              }
            }
            pokemon_v2_pokemonabilities {
              pokemon_v2_ability {
                pokemon_v2_abilitynames {
                  language_id
                  name
                  pokemon_v2_language {
                    name
                    id
                  }
                }
                pokemon_v2_abilityflavortexts {
                  flavor_text
                  language_id
                  pokemon_v2_language {
                    name
                    id
                  }
                }
              }
              is_hidden
            }
          }
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
              pokemon_v2_versionnames {
                name
                pokemon_v2_language {
                  id
                  name
                }
              }
            }
          }
          pokemon_v2_generation {
            name
            pokemon_v2_generationnames {
              language_id
              name
              pokemon_v2_language {
                name
                id
              }
            }
          }
          pokemon_v2_pokemoncolor {
            id
            name
            pokemon_v2_pokemoncolornames {
              name
              language_id
              pokemon_v2_language {
                id
                name
              }
            }
          }
          pokemon_v2_pokemonshape {
            name
            id
            pokemon_v2_pokemonshapenames {
              language_id
              name
              pokemon_v2_language {
                name
                id
              }
            }
          }
        }
      }
    `,

  GetPokemonSpeciesPaginated: `
      query PokemonSpeciesOverview($limit: Int, $offset: Int) {
        pokemon_v2_pokemonspecies(limit: $limit, offset: $offset, order_by: {id: asc}) {
          pokemon_v2_pokemons(where: {is_default: {_eq: true}}) {
            id
            pokemon_v2_pokemonsprites {
              sprites
            }
          }
          id
          pokemon_v2_pokemonspeciesnames(where: {pokemon_v2_language: {name: {_eq: "en"}}}) {
            name
            pokemon_v2_language {
              name
              id
            }
          }
          pokemon_v2_generation {
            id
            name
          }
        }
        pokemon_v2_pokemonspecies_aggregate {
          aggregate {
            count
          }
        }
      }
    `,

  GetPokemonSpeciesAll: `
    query GetAllPokemonSpecies {
      pokemon_v2_pokemonspecies(order_by: {id: asc}) {
        pokemon_v2_pokemons(where: {is_default: {_eq: true}}) {
          id
          pokemon_v2_pokemonsprites {
            sprites
          }
        }
        id
        pokemon_v2_pokemonspeciesnames {
          name
          pokemon_v2_language {
            name
            id
          }
        }
        pokemon_v2_generation {
          id
          name
          pokemon_v2_generationnames {
            name
            pokemon_v2_language {
              id
              name
            }
          }
        }
      }
      pokemon_v2_pokemonspecies_aggregate {
        aggregate {
          count
        }
      }
    }
  `,

  GetPokemonSpeciesByPrefix: `
      query MyQuery($search: String!, $languageId: Int!) {
        pokemon_v2_pokemonspecies(
          where: {
            pokemon_v2_pokemonspeciesnames: {
              name: { _ilike: $search },
              pokemon_v2_language: { id: { _eq: $languageId } }
            }
          }
          order_by: { id: asc }
        ) {
          id
          name
          pokemon_v2_pokemons {
            pokemon_v2_pokemonsprites {
              sprites
            }
          }
          pokemon_v2_pokemonspeciesnames(
            where: { pokemon_v2_language: { id: { _eq: $languageId } } }
          ) {
            name
            pokemon_v2_language {
              name
              id
            }
          }
        }
      }
    `,

  GetPokemonSpeciesWithoutPrefix: `
      query MyQuery {
        pokemon_v2_pokemonspecies(order_by: {id: asc}, limit: 15) {
          id
          name
          pokemon_v2_pokemons {
            pokemon_v2_pokemonsprites {
              sprites
            }
          }
          pokemon_v2_pokemonspeciesnames {
            name
            pokemon_v2_language {
              name
              id
            }
          }
        }
      }
    `,

  GetLanguages: `
      query Languages {
        pokemon_v2_language {
          name
          id
        }
      }
    `,

  GetVersions: `query Versions {
      pokemon_v2_version {
        id
        pokemon_v2_versionnames {
          name
          pokemon_v2_language {
            id
            name
          }
        }
      }
    }
    `,

  GetPokemonSpeciesById: `
      query GetPokemonSpeciesById($id: Int!) {
        pokemon_v2_pokemonspecies(order_by: { id: asc }, where: { id: { _eq: $id } }) {
          pokemon_v2_pokemons(where: { is_default: { _eq: true } }) {
            id
            pokemon_v2_pokemonsprites {
              sprites
            }
          }
          id
          pokemon_v2_pokemonspeciesnames {
            name
            pokemon_v2_language {
              name
              id
            }
          }
        }
      }
    `,

  GetPokemonEvolutions: `
      query GetPokemonEvolutions($id: Int!) {
        pokemon_v2_pokemonevolution(where: {evolved_species_id: {_eq: $id}}) {
          evolution_item_id
          evolution_trigger_id
          evolved_species_id
          gender_id
          held_item_id
          id
          known_move_id
          known_move_type_id
          location_id
          min_affection
          min_beauty
          min_happiness
          min_level
          needs_overworld_rain
          party_species_id
          party_type_id
          relative_physical_stats
          time_of_day
          trade_species_id
          turn_upside_down
          pokemon_v2_evolutiontrigger {
            name
            pokemon_v2_evolutiontriggernames {
              name
              pokemon_v2_language {
                name
                id
              }
            }
          }
          pokemonV2ItemByHeldItemId {
            name
            pokemon_v2_itemnames {
              name
              language_id
              pokemon_v2_language {
                name
                id
              }
            }
            pokemon_v2_itemsprites {
              sprites
            }
          }
          pokemon_v2_gender {
            name
            id
          }
          pokemon_v2_item {
            name
            pokemon_v2_itemnames {
              name
              language_id
              pokemon_v2_language {
                name
                id
              }
            }
            pokemon_v2_itemsprites {
              sprites
            }
          }
          pokemonV2PokemonspecyByPartySpeciesId {
            name
            id
            pokemon_v2_pokemonspeciesnames {
              name
              language_id
              pokemon_v2_language {
                name
                id
              }
            }
          }
          pokemonV2PokemonspecyByTradeSpeciesId {
            name
            id
            pokemon_v2_pokemonspeciesnames {
              name
              language_id
              pokemon_v2_language {
                name
                id
              }
            }
          }
          pokemonV2TypeByPartyTypeId {
            name
            pokemon_v2_typenames {
              name
              language_id
              pokemon_v2_language {
                id
                name
              }
            }
          }
          pokemon_v2_location {
            name
            id
            region_id
            pokemon_v2_locationnames {
              language_id
              name
              id
              pokemon_v2_language {
                id
                name
              }
            }
          }
          pokemon_v2_move {
            name
            id
            pokemon_v2_movenames {
              id
              name
              language_id
              pokemon_v2_language {
                name
                id
              }
            }
          }
          pokemon_v2_type {
            name
            id
            pokemon_v2_typenames {
              id
              name
              pokemon_v2_language {
                id
                name
              }
            }
          }
        }
      }
    `,
};
