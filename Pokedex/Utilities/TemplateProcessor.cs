namespace Pokedex.Utilities
{
    public class TemplateProcessor
    {
        public static string ProcessEndpointTemplate(string template, object parameters)
        {
            foreach (var property in parameters.GetType().GetProperties())
            {
                string placeholder = $"{{{property.Name}}}";
                if (template.Contains(placeholder))
                {
                    template = template.Replace(placeholder, property.GetValue(parameters)?.ToString());
                }
            }
            return template;
        }
    }
}
