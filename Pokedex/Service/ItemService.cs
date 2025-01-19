using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;
using Pokedex.Constants;
using Pokedex.Model;
using Pokedex.Service.Interface;

namespace Pokedex.Service
{
    public class ItemService : IItemService
    {
        private readonly HttpClient _httpClient;
        private readonly ApiPaths _apiPaths;

        public ItemService(HttpClient httpClient, IOptions<ApiPaths> apiPath)
        {
            _httpClient = httpClient;
            _apiPaths = apiPath.Value;
        }

        public async Task<IEnumerable<ItemDto>> GetAllPokeBallsAsync()
        {
            var items = new List<ItemDto>();

            // Fetch items from the item-category endpoint
            var response = await _httpClient.GetAsync(_apiPaths.Pokeballs);
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            var categoryList = JsonConvert.DeserializeObject<ItemCategoryDto>(jsonResponse);

            // Fetch details for each item
            var detailTasks = categoryList.Items.Select(async item =>
            {
                var itemDetailsResponse = await _httpClient.GetAsync(item.Url);
                itemDetailsResponse.EnsureSuccessStatusCode();

                var itemDetailsJson = await itemDetailsResponse.Content.ReadAsStringAsync();
                var itemDetails = JsonConvert.DeserializeObject<ItemDto>(itemDetailsJson);

                return itemDetails;
            });

            var itemDetailsList = await Task.WhenAll(detailTasks);
            items.AddRange(itemDetailsList);

            return items;
        }
    }
}