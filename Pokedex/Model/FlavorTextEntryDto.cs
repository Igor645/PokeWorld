namespace Pokedex.Model
{
    public class FlavorTextEntryDto
    {
        public string FlavorText { get; set; }
        public EndpointLookupDto Language { get; set; }
        public EndpointLookupDto Version { get; set; }
    }
}
