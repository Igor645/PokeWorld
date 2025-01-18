using Pokedex.Components;
using Pokedex.Constants;
using Pokedex.Service;
using Pokedex.Service.Interface;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

var httpClientSettings = builder.Configuration.GetSection("HttpClientSettings");
builder.Services.AddScoped(sp =>
    new HttpClient { BaseAddress = new Uri(httpClientSettings["BaseAddress"]) });

builder.Services.AddScoped<IPokemonService, PokemonService>();
builder.Services.AddScoped<IItemService, ItemService>();
builder.Services.Configure<ApiPaths>(builder.Configuration.GetSection("ApiPaths"));

var app = builder.Build();



// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();

    app.UseStaticFiles(new StaticFileOptions
    {
        OnPrepareResponse = ctx =>
        {
            ctx.Context.Response.Headers.Add("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
            ctx.Context.Response.Headers.Add("Pragma", "no-cache");
            ctx.Context.Response.Headers.Add("Expires", "0");
        }
    });
}

app.UseHttpsRedirection();

app.UseStaticFiles();
app.UseAntiforgery();

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
