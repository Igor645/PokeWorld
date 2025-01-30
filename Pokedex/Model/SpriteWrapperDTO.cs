using System.Text.Json.Serialization;

namespace Pokedex.Model
{
    public class SpriteWrapperDto<T> where T : new()
    {
        [JsonPropertyName("sprites")]
        public T Sprites { get; set; } = default!;

        public SpriteWrapperDto()
        {
            Sprites = new T();
        }
    }
}
