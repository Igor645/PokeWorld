namespace Pokedex.Extensions
{
    public static class HttpClientExtensions
    {
        public static async Task<T> WithCancellation<T>(this Task<T> task, CancellationToken cancellationToken)
        {
            var tcs = new TaskCompletionSource();
            await using (cancellationToken.Register(() => tcs.TrySetCanceled()))
            {
                var completedTask = await Task.WhenAny(task, tcs.Task);
                if (completedTask == tcs.Task) throw new OperationCanceledException(cancellationToken);
            }

            return await task;
        }
    }
}
