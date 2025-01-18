using Pokedex.Model;

namespace Pokedex.Service.Interface
{
    public interface IPokemonService
    {
        Task<IEnumerable<PokemonSpeciesDto>> GetPokemonSpeciesPaginated(int limit, int offset);
    }
}
