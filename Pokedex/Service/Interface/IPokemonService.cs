using Pokedex.Model;

namespace Pokedex.Service.Interface
{
    public interface IPokemonService
    {
        Task<PokeApiResponseDto<PokemonSpeciesDto>> GetPokemonSpeciesPaginated(int limit, int offset);
    }
}
