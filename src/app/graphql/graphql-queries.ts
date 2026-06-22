import { gql } from 'graphql-request';

// ── Shared Fragments ──────────────────────────────────────────────────────────

const LangFields = gql`
  fragment LangFields on language { id name }
`;

const ItemFields = gql`
  fragment ItemFields on item {
    id name
    itemnames { name language_id language { ...LangFields } }
    itemsprites { sprites }
  }
`;

const PokemonEvolutionFields = gql`
  fragment PokemonEvolutionFields on pokemonevolution {
    evolution_item_id evolution_trigger_id evolved_species_id gender_id
    held_item_id id known_move_id known_move_type_id location_id
    min_affection min_beauty min_happiness min_level needs_overworld_rain
    party_species_id party_type_id relative_physical_stats time_of_day
    trade_species_id turn_upside_down
    evolutiontrigger {
      name
      evolutiontriggernames { name language_id language { ...LangFields } }
    }
    ItemByHeldItemId { ...ItemFields }
    gender { name id }
    item { ...ItemFields }
    PokemonspecyByPartySpeciesId {
      name id
      pokemonspeciesnames { name language_id language { ...LangFields } }
    }
    PokemonspecyByTradeSpeciesId {
      name id
      pokemonspeciesnames { name language_id language { ...LangFields } }
    }
    TypeByPartyTypeId {
      name
      typenames { name language_id language { ...LangFields } }
    }
    location {
      name id region_id
      locationnames { language_id name id language { ...LangFields } }
    }
    move {
      name id
      movenames { id name language_id language { ...LangFields } }
    }
    type {
      name id
      typenames { id name language_id language { ...LangFields } }
    }
  }
`;

const PokemonSpeciesDetailFields = gql`
  fragment PokemonSpeciesDetailFields on pokemonspecies {
    id name is_legendary is_mythical is_baby
    evolution_chain_id evolves_from_species_id
    base_happiness capture_rate gender_rate hatch_counter
    evolutionchain {
      baby_trigger_item_id
      item { ...ItemFields }
      pokemonspecies {
        id name evolves_from_species_id
        pokemons {
          id name is_default
          pokemonsprites { sprites }
        }
        pokemonspeciesnames { name language_id language { ...LangFields } }
        generation {
          id name
          generationnames { name language_id language { ...LangFields } }
        }
      }
    }
    pokemonhabitat {
      name id
      pokemonhabitatnames { id language_id name language { ...LangFields } }
    }
    pokemonegggroups {
      id egg_group_id
      egggroup {
        name id
        egggroupnames { name language_id language { ...LangFields } }
      }
    }
    growthrate {
      name id formula
      growthratedescriptions {
        name: description id language_id
        language { ...LangFields }
      }
    }
    pokemons {
      id name height weight is_default base_experience
      pokemonsprites { sprites }
      pokemoncries { cries }
      pokemonstats {
        base_stat effort
        stat {
          id name
          statnames { language_id name language { ...LangFields } }
        }
      }
      pokemonforms {
        id name
        pokemonformsprites { sprites }
        pokemonformnames { language_id name language { ...LangFields } }
      }
      pokemontypes {
        type {
          id name
          typenames { language_id name language { ...LangFields } }
        }
      }
      pokemontypepasts {
        generation_id
        slot
        type {
          id name
          typenames { language_id name language { ...LangFields } }
        }
      }
      pokemonitems {
        id rarity
        version {
          name id
          versionnames { id language_id name language { ...LangFields } }
        }
        item { ...ItemFields }
      }
      pokemonabilities {
        ability {
          name
          abilitynames { language_id name language { ...LangFields } }
          abilityflavortexts { flavor_text language_id language { ...LangFields } }
        }
        is_hidden
      }
    }
    pokemonspeciesnames { name language_id language { ...LangFields } }
    pokemonspeciesflavortexts {
      flavor_text id language_id
      language { ...LangFields }
      version {
        name id
        versionnames { name language_id language { ...LangFields } }
      }
    }
    generation {
      id name
      generationnames { language_id name language { ...LangFields } }
    }
    pokemoncolor {
      id name
      pokemoncolornames { name language_id language { ...LangFields } }
    }
    pokemonshape {
      name id
      pokemonshapenames { language_id name language { ...LangFields } }
    }
  }
`;

// ── Queries ───────────────────────────────────────────────────────────────────

export const GraphQLQueries = {

  // Pokemon Species Detail — three variants
  GetPokemonDetailsById: gql`
    ${LangFields} ${ItemFields} ${PokemonSpeciesDetailFields}
    query GetPokemonDetailsById($id: Int!) {
      pokemonspecies(where: { id: { _eq: $id } }) { ...PokemonSpeciesDetailFields }
    }
  `,

  GetPokemonDetailsByLocalizedName: gql`
    ${LangFields} ${ItemFields} ${PokemonSpeciesDetailFields}
    query GetPokemonDetailsByLocalizedName($name: String!) {
      pokemonspecies(where: { pokemonspeciesnames: { name: { _ilike: $name } } }) {
        ...PokemonSpeciesDetailFields
      }
    }
  `,

  GetPokemonDetailsBySlug: gql`
    ${LangFields} ${ItemFields} ${PokemonSpeciesDetailFields}
    query GetPokemonDetailsBySlug($name: String!) {
      pokemonspecies(where: { name: { _ilike: $name } }) { ...PokemonSpeciesDetailFields }
    }
  `,

  // Paginated list — English names only, default sprite only, no language sub-object
  GetPokemonSpeciesPaginated: gql`
    query PokemonSpeciesOverview($limit: Int, $offset: Int) {
      pokemonspecies(limit: $limit, offset: $offset, order_by: { id: asc }) {
        name id
        pokemons(where: { is_default: { _eq: true } }) {
          id
          pokemonsprites { sprites }
        }
        pokemonspeciesnames(where: { language_id: { _eq: 9 } }) {
          name language_id
        }
        generation { id name }
      }
      pokemonspecies_aggregate { aggregate { count } }
    }
  `,

  // Full species list — used by Quiz & Pokéle.
  // $languageId filters names to [current, English] — ~85% fewer name rows vs fetching all 13 langs.
  // generationnames filtered to [$languageId, 9] — 9 gens × 2 langs only.
  GetPokemonSpeciesAll: gql`
    query GetAllPokemonSpecies($languageId: Int!) {
      pokemonspecies(order_by: { id: asc }) {
        name id is_legendary is_mythical is_baby
        pokemons(order_by: { is_default: desc }) {
          id name is_default
          pokemonsprites { sprites }
          pokemontypes { type { id name } }
        }
        pokemonspeciesnames(
          where: { language_id: { _in: [$languageId, 9] } }
        ) {
          name language_id
        }
        generation {
          id name
          generationnames { name language_id }
        }
        evolves_from_species_id
      }
      pokemonspecies_aggregate { aggregate { count } }
    }
  `,

  // Search autocomplete — default form only, no language sub-object
  GetPokemonSpeciesByPrefix: gql`
    query GetPokemonSpeciesByPrefix($search: String!, $languageId: Int!) {
      pokemonspecies(
        where: {
          pokemonspeciesnames: { name: { _ilike: $search }, language_id: { _eq: $languageId } }
        }
        order_by: { id: asc }
      ) {
        id name
        pokemons(where: { is_default: { _eq: true } }) {
          id
          pokemonsprites { sprites }
        }
        pokemonspeciesnames(where: { language_id: { _eq: $languageId } }) {
          name language_id
        }
      }
    }
  `,

  GetPokemonSpeciesWithoutPrefix: gql`
    query GetPokemonSpeciesWithoutPrefix {
      pokemonspecies(order_by: { id: asc }, limit: 15) {
        id name
        pokemons(where: { is_default: { _eq: true } }) {
          id
          pokemonsprites { sprites }
        }
        pokemonspeciesnames { name language_id }
      }
    }
  `,

  GetPokemonSpeciesById: gql`
    query GetPokemonSpeciesById($id: Int!) {
      pokemonspecies(order_by: { id: asc }, where: { id: { _eq: $id } }) {
        name id
        pokemons(where: { is_default: { _eq: true } }) {
          id
          pokemonsprites { sprites }
        }
        pokemonspeciesnames { name language_id }
      }
    }
  `,

  // Evolutions
  GetPokemonEvolutions: gql`
    ${LangFields} ${ItemFields} ${PokemonEvolutionFields}
    query GetPokemonEvolutions($id: Int!) {
      pokemonevolution(where: { evolved_species_id: { _eq: $id } }) {
        ...PokemonEvolutionFields
      }
    }
  `,

  GetPokemonEvolutionsByIds: gql`
    ${LangFields} ${ItemFields} ${PokemonEvolutionFields}
    query GetPokemonEvolutionsByIds($ids: [Int!]!) {
      pokemonevolution(where: { evolved_species_id: { _in: $ids } }) {
        ...PokemonEvolutionFields
      }
    }
  `,

  // Types
  GetAllTypes: gql`
    ${LangFields}
    query GetAllTypes {
      type {
        id name
        typenames { language_id name language { ...LangFields } }
        typeefficacies {
          damage_factor damage_type_id target_type_id
          TypeByTargetTypeId {
            id name
            typenames { language_id name language { ...LangFields } }
          }
        }
      }
    }
  `,

  // Moves
  GetPokemonMoveOptions: gql`
    query GetPokemonMoveOptions($pokemonId: Int!) {
      pokemon(where: { id: { _eq: $pokemonId } }) {
        pokemonmoves {
          versiongroup {
            id name
            generation {
              id name
              generationnames { name language_id }
            }
            versions { id versionnames { name language_id } }
          }
          movelearnmethod { id name movelearnmethodnames { language_id id name } }
        }
      }
    }
  `,

  GetPokemonMovesByFilter: gql`
    query GetPokemonMovesByFilter($pokemonId: Int!, $versionGroupId: Int!, $methodId: Int!) {
      pokemon(where: { id: { _eq: $pokemonId } }) {
        pokemonmoves(where: {
          versiongroup: { id: { _eq: $versionGroupId } }
          movelearnmethod: { id: { _eq: $methodId } }
        }) {
          level id
          versiongroup { id }
          move {
            id name accuracy power pp priority
            generation {
              id name
              generationnames { language_id name }
            }
            moveflavortexts {
              id flavor_text version_group_id language_id
              language { id name }
            }
            movenames { name language_id }
            movedamageclass { id name movedamageclassnames { language_id name } }
            machines {
              id machine_number version_group_id
              item { id name itemnames { name language_id } itemsprites { sprites } }
            }
            type { id name typenames { name language_id } }
          }
          movelearnmethod { id name movelearnmethodnames { language_id id name } }
        }
      }
    }
  `,

  // Languages & Versions
  GetLanguages: gql`
    query GetLanguages {
      language { name id }
    }
  `,

  GetVersions: gql`
    ${LangFields}
    query GetVersions {
      version {
        id
        versionnames { name language_id language { ...LangFields } }
      }
    }
  `,
};
