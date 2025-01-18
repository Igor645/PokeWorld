let lastKnownScrollPosition = 0;
let ticking = false;

function addScrollListener(dotNetHelper, selector) {
    const contentElement = document.querySelector(selector);

    if (!contentElement) {
        console.error(`Element with selector '${selector}' not found.`);
        return;
    }

    contentElement.addEventListener("scroll", () => {
        const currentScrollPosition = contentElement.scrollTop;

        if (!ticking) {
            window.requestAnimationFrame(() => {
                // Call Blazor method to update button visibility
                const showButton = currentScrollPosition > 300;
                dotNetHelper.invokeMethodAsync("HandleScrollChanged", currentScrollPosition, showButton)
                    .catch(err => console.error("Error calling OnScrollChanged:", err));
                ticking = false;
            });

            ticking = true;
        }

        lastKnownScrollPosition = currentScrollPosition;
    });
}

function scrollToTop(selector) {
    const contentElement = document.querySelector(selector);

    if (!contentElement) {
        console.error(`Element with selector '${selector}' not found.`);
        return;
    }

    contentElement.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addScrollListener = addScrollListener;
window.scrollToTop = scrollToTop;
