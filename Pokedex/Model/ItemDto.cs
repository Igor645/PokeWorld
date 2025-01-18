using System.Collections.Generic;

namespace Pokedex.Model
{
    public class ItemDto
    {
        public string Name { get; set; }
        public string Url { get; set; }
        public ItemSprites Sprites { get; set; }
        public ItemCategory Category { get; set; }
    }

    public class ItemSprites
    {
        public string Default { get; set; }
    }

    public class ItemCategory
    {
        public string Name { get; set; }
        public string Url { get; set; }
    }
}