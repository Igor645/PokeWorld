using Pokedex.Model;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Pokedex.Service.Interface
{
    public interface IItemService
    {
        Task<ItemResponseDto> GetAllPokeBallsAsync();
    }
}