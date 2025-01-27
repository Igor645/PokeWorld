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
                const showButton = currentScrollPosition > 300;
                dotNetHelper.invokeMethodAsync("HandleScrollChanged", currentScrollPosition, showButton)
                    .catch(err => console.error("Error calling OnScrollChanged:", err));
                toggleScrollToTopButton(showButton);
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

function toggleScrollToTopButton(show) {
    const scrollToTopButton = document.querySelector('.scroll-to-top');
    console.log(scrollToTopButton.classList);

    if (scrollToTopButton) {
        if (show) {
            scrollToTopButton.classList.remove('hide');
            scrollToTopButton.classList.add('show');
        } else {
            scrollToTopButton.classList.remove('show');
            scrollToTopButton.classList.add('hide');
        }
    }
}


window.addScrollListener = addScrollListener;
window.scrollToTop = scrollToTop;
