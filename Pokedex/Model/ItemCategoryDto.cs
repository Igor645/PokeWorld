namespace Pokedex.Model
{
    public class ItemCategoryDto
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public List<ItemDto> Items { get; set; }
    }
}
