export const GraphQLQueries = {
  GetPokemonDetails: `
      query PokemonDetails($value: {TYPE}) {
        pokemonspecies(
          where: { {FILTER} }
        ) {
          id
          name
          is_legendary
          is_mythical
          is_baby
          evolution_chain_id
          evolves_from_species_id
          base_happiness
          capture_rate
          gender_rate
          hatch_counter
          evolutionchain {
            baby_trigger_item_id
            item {
              name
              id
              itemnames {
                id
                name
                language_id
                language {
                  id
                  name
                }
              }
              itemsprites {
                sprites
              }
            }
            pokemonspecies {
              id
              name
              evolves_from_species_id
              pokemons(where: {is_default: {_eq: true}}) {
                id
                pokemonsprites {
                  sprites
                }
              }
              pokemonspeciesnames {
                name
                language_id
                language {
                  name
                  id
                }
              }
              generation {
                id
                name
                generationnames {
                  name
                  language_id
                  language {
                    id
                    name
                  }
                }
              }
            }
          }
          pokemonhabitat {
            name
            id
            pokemonhabitatnames {
              id
              language_id
              name
              language {
                id
                name
              }
            }
          }
          pokemonegggroups {
            id
            egg_group_id
            egggroup {
              name
              id
              egggroupnames {
                name
                language_id
                language {
                  id
                  name
                }
              }
            }
          }
          growthrate {
            name
            id
            formula
            growthratedescriptions {
              name: description
              id
              language_id
              language {
                id
                name
              }
            }
          }
          pokemons {
            id
            name
            height
            weight
            is_default
            base_experience
            pokemonsprites {
              sprites
            }
            pokemoncries {
              cries
            }
            pokemonstats {
              base_stat
              effort
              stat {
                id
                name
                statnames {
                  language_id
                  name
                  language {
                    id
                    name
                  }
                }
              }
            }
            pokemonmoves {
              level
              id
              versiongroup {
                id
                name
                generation {
                  id
                  name
                  generationnames {
                    name
                    language_id
                  }
                }
                versions {
                  versionnames {
                    name
                    language_id
                  }
                }
              }
              move {
                id
                name
                accuracy
                power
                pp
                priority
                generation {
                  id
                  name
                  generationnames {
                    language_id
                    name
                  }
                }
                movenames {
                  name
                  language_id
                }
                movedamageclass {
                  id
                  name
                  movedamageclassnames {
                    language_id
                    name
                  }
                }
                machines {
                  id
                  machine_number
                  version_group_id
                  item {
                    id
                    name
                    itemnames {
                      name
                      language_id
                    }
                    itemsprites {
                      sprites
                    }
                  }
                }
                type {
                  id
                  name
                  typenames {
                    name
                    language_id
                  }
                }
              }
              movelearnmethod {
                id
                name
                movelearnmethodnames {
                  language_id
                  id
                  name
                }
              }
            }
            pokemonforms {
              id
              name
              pokemonformsprites {
                sprites
              }
              pokemonformnames {
                language_id
                name
                language {
                  id
                  name
                }
              }
            }
            pokemontypes {
              type {
                id
                name
                typenames {
                  language_id
                  name
                  language {
                    id
                    name
                  }
                }
              }
            }
            pokemonitems {
              id
              rarity
              version {
                name
                id
                versionnames {
                  id
                  language_id
                  name
                  language {
                    id
                    name
                  }
                }
              }
              item {
                id
                name
                itemnames {
                  id
                  language_id
                  name
                  language {
                    name
                    id
                  }
                }
                itemsprites {
                  sprites
                }
              }
            }
            pokemonabilities {
              ability {
                name
                abilitynames {
                  language_id
                  name
                  language {
                    name
                    id
                  }
                }
                abilityflavortexts {
                  flavor_text
                  language_id
                  language {
                    name
                    id
                  }
                }
              }
              is_hidden
            }
          }
          pokemonspeciesnames {
            name
            language_id
            language {
              name
              id
            }
          }
          pokemonspeciesflavortexts {
            flavor_text
            id
            language_id
            language {
              name
              id
            }
            version {
              name
              id
              versionnames {
                name
                language_id
                language {
                  id
                  name
                }
              }
            }
          }
          generation {
            name
            generationnames {
              language_id
              name
              language {
                name
                id
              }
            }
          }
          pokemoncolor {
            id
            name
            pokemoncolornames {
              name
              language_id
              language {
                id
                name
              }
            }
          }
          pokemonshape {
            name
            id
            pokemonshapenames {
              language_id
              name
              language {
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
        pokemonspecies(limit: $limit, offset: $offset, order_by: {id: asc}) {
          name
          pokemons(where: {is_default: {_eq: true}}) {
            id
            pokemonsprites {
              sprites
            }
          }
          id
          pokemonspeciesnames(where: {language: {name: {_eq: "en"}}}) {
            name
            language_id
            language {
              name
              id
            }
          }
          generation {
            id
            name
          }
        }
        pokemonspecies_aggregate {
          aggregate {
            count
          }
        }
      }
    `,

  GetPokemonSpeciesAll: `
    query GetAllPokemonSpecies {
      pokemonspecies(order_by: {id: asc}) {
        name
        pokemons(where: {is_default: {_eq: true}}) {
          id
          pokemonsprites {
            sprites
          }
        }
        id
        pokemonspeciesnames {
          name
          language_id
          language {
            name
            id
          }
        }
        generation {
          id
          name
          generationnames {
            name
            language_id
            language {
              id
              name
            }
          }
        }
      }
      pokemonspecies_aggregate {
        aggregate {
          count
        }
      }
    }
  `,

  GetPokemonSpeciesByPrefix: `
      query MyQuery($search: String!, $languageId: Int!) {
        pokemonspecies(
          where: {
            pokemonspeciesnames: {
              name: { _ilike: $search },
              language: { id: { _eq: $languageId } }
            }
          }
          order_by: { id: asc }
        ) {
          id
          name
          pokemons {
            pokemonsprites {
              sprites
            }
          }
          pokemonspeciesnames(
            where: { language_id: { _eq: $languageId } }
          ) {
            name
            language_id
            language {
              name
              id
            }
          }
        }
      }
    `,

  GetPokemonSpeciesWithoutPrefix: `
      query MyQuery {
        pokemonspecies(order_by: {id: asc}, limit: 15) {
          id
          name
          pokemons {
            pokemonsprites {
              sprites
            }
          }
          pokemonspeciesnames {
            name
            language_id
            language {
              name
              id
            }
          }
        }
      }
    `,

  GetLanguages: `
      query Languages {
        language {
          name
          id
        }
      }
    `,

  GetVersions: `query Versions {
      version {
        id
        versionnames {
          name
          language_id
          language {
            id
            name
          }
        }
      }
    }
    `,

  GetPokemonSpeciesById: `
      query GetPokemonSpeciesById($id: Int!) {
        pokemonspecies(order_by: { id: asc }, where: { id: { _eq: $id } }) {
          name
          pokemons(where: { is_default: { _eq: true } }) {
            id
            pokemonsprites {
              sprites
            }
          }
          id
          pokemonspeciesnames {
            name
            language_id
            language {
              name
              id
            }
          }
        }
      }
    `,

  GetPokemonEvolutions: `
      query GetPokemonEvolutions($id: Int!) {
        pokemonevolution(where: {evolved_species_id: {_eq: $id}}) {
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
          evolutiontrigger {
            name
            evolutiontriggernames {
              name
              language_id
              language {
                name
                id
              }
            }
          }
          ItemByHeldItemId {
            name
            itemnames {
              name
              language_id
              language {
                name
                id
              }
            }
            itemsprites {
              sprites
            }
          }
          gender {
            name
            id
          }
          item {
            name
            itemnames {
              name
              language_id
              language {
                name
                id
              }
            }
            itemsprites {
              sprites
            }
          }
          PokemonspecyByPartySpeciesId {
            name
            id
            pokemonspeciesnames {
              name
              language_id
              language {
                name
                id
              }
            }
          }
          PokemonspecyByTradeSpeciesId {
            name
            id
            pokemonspeciesnames {
              name
              language_id
              language {
                name
                id
              }
            }
          }
          TypeByPartyTypeId {
            name
            typenames {
              name
              language_id
              language {
                id
                name
              }
            }
          }
          location {
            name
            id
            region_id
            locationnames {
              language_id
              name
              id
              language {
                id
                name
              }
            }
          }
          move {
            name
            id
            movenames {
              id
              name
              language_id
              language {
                name
                id
              }
            }
          }
          type {
            name
            id
            typenames {
              id
              name
              language_id
              language {
                id
                name
              }
            }
          }
        }
      }
    `,

  GetAllTypes: `
    query GetTypes {
      type {
        id
        name
        typenames {
          language_id
          name
          language {
            id
            name
          }
        }
        typeefficacies {
          damage_factor
          damage_type_id
          target_type_id
          TypeByTargetTypeId {
            id
            name
            typenames {
              language_id
              name
              language {
                id
                name
              }
            }
          }
        }
      }
    }`,
};
