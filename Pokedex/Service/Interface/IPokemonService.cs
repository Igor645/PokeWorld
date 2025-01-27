using Pokedex.Model;

namespace Pokedex.Service.Interface
{
    public interface IPokemonService
    {
        Task<PokemonSpeciesResponseDto> GetPokemonSpeciesByPrefix(string prefix);
        Task<PokemonSpeciesResponseDto> GetPokemonSpeciesPaginatedGraphQL(int limit, int offset);
    }
}
