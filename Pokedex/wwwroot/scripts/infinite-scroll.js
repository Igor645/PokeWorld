window.isScrollBottom = (elementId, buffer = 500) => {
    const element = document.querySelector(elementId);
    if (!element) return false;

    const { scrollTop, scrollHeight, clientHeight } = element;
    return scrollTop + clientHeight >= scrollHeight - buffer;
};

function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function (...args) {
        const context = this;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(() => {
                if (Date.now() - lastRan >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

window.addSmoothScrollListener = (elementId, dotNetHelper, delay = 100, buffer = 500) => {
    const element = document.querySelector(elementId);
    if (!element) {
        console.error(`Element with selector '${elementId}' not found.`);
        return;
    }

    const onScroll = throttle(() => {
        if (window.isScrollBottom(elementId, buffer)) {
            dotNetHelper.invokeMethodAsync("OnScrollReachedBottom")
                .catch(err => console.error("Error invoking OnScrollReachedBottom:", err));
        }
    }, delay);

    element.addEventListener("scroll", onScroll);

    return () => element.removeEventListener("scroll", onScroll);
};

