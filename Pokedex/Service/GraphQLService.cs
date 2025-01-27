using GraphQL.Client.Http;
using GraphQL.Client.Serializer.SystemTextJson;
using System.Text.Json;

public class GraphQLService
{
    private readonly GraphQLHttpClient _client;
    private readonly string _graphqlEndpoint;

    public GraphQLService(string graphqlEndpoint)
    {
        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true // Ignore case when mapping properties
        };

        _graphqlEndpoint = graphqlEndpoint;
        _client = new GraphQLHttpClient(graphqlEndpoint, new SystemTextJsonSerializer(options));
    }

    public async Task<string> ExecuteQueryRawAsync(string query, object variables = null)
    {
        var request = new GraphQLHttpRequest
        {
            Query = query,
            Variables = variables
        };

        // Send the query and fetch the raw HTTP response
        var httpResponse = await _client.HttpClient.PostAsJsonAsync(_graphqlEndpoint, request);

        // Ensure the request succeeded
        httpResponse.EnsureSuccessStatusCode();

        // Read and return the raw response content as a string
        var rawResponse = await httpResponse.Content.ReadAsStringAsync();
        return rawResponse;
    }

    public async Task<T> ExecuteQueryAsync<T>(string query, object variables = null)
    {
        var request = new GraphQLHttpRequest
        {
            Query = query,
            Variables = variables
        };

        // Log the raw response for debugging purposes
        var rawResponse = await ExecuteQueryRawAsync(query, variables);
        Console.WriteLine($"Raw GraphQL Response: {rawResponse}");

        // Send the query and deserialize the response
        var response = await _client.SendQueryAsync<T>(request);
        return response.Data;
    }

    public async Task<T> ExecuteMutationAsync<T>(string mutation, object variables = null)
    {
        var request = new GraphQLHttpRequest
        {
            Query = mutation,
            Variables = variables
        };

        var response = await _client.SendMutationAsync<T>(request);
        return response.Data;
    }
}
