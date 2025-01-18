namespace Pokedex.Model
{
    public class PokemonSpeciesDto
    {
        public int BaseHappiness { get; set; }
        public int CaptureRate { get; set; }
        public EndpointLookupDto Color { get; set; }
        public List<EndpointLookupDto> EggGroups { get; set; }
        public EndpointLookupDto EvolutionChain { get; set; }
        public EndpointLookupDto EvolvesFromSpecies { get; set; }
        public List<FlavorTextEntryDto> FlavorTextEntries { get; set; }
        public List<FormDescriptionDto> FormDescriptions { get; set; }
        public bool FormsSwitchable { get; set; }
        public int GenderRate { get; set; }
        public List<GenusDto> Genera { get; set; }
        public EndpointLookupDto Generation { get; set; }
        public EndpointLookupDto GrowthRate { get; set; }
        public EndpointLookupDto Habitat { get; set; }
        public bool HasGenderDifferences { get; set; }
        public int HatchCounter { get; set; }
        public int Id { get; set; }
        public bool IsBaby { get; set; }
        public bool IsLegendary { get; set; }
        public bool IsMythical { get; set; }
        public string Name { get; set; }
        public List<NameDto> Names { get; set; }
        public int Order { get; set; }
        public List<PalParkEncounterDto> PalParkEncounters { get; set; }
        public List<PokedexNumberDto> PokedexNumbers { get; set; }
        public EndpointLookupDto Shape { get; set; }
        public List<VarietyDto> Varieties { get; set; }
    }
}
