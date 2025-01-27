using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Pokedex.Model;
using Pokedex.Service.Interface;

namespace Pokedex.Service
{
    public class ItemService : IItemService
    {
        private readonly GraphQLService _graphQLService;

        public ItemService(GraphQLService graphQLService)
        {
            _graphQLService = graphQLService;
        }

        public async Task<ItemResponseDto> GetAllPokeBallsAsync()
        {
            string query = @"            
            query ItemImages {
              pokemon_v2_item(where: {pokemon_v2_itemcategory: {name: {_in: [""standard-balls"", ""special-balls""]}}}) {
                id
                name
                pokemon_v2_itemsprites {
                  sprites
                }
              }
            }";

            var response = await _graphQLService.ExecuteQueryAsync<ItemResponseDto>(query, null);

            return response;
        }
    }
}
