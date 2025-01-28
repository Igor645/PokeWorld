using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class SpriteWrapperDTO<T> where T : new()
    {
        [JsonPropertyName("sprites")]
        public T Sprites { get; set; } = default!;

        public SpriteWrapperDTO()
        {
            Sprites = new T();
        }
    }
}
