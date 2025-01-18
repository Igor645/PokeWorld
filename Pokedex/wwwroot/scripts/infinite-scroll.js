window.isScrollBottom = (elementId) => {
    const element = document.querySelector(`${elementId}`);
    if (!element) return false;

    const { scrollTop, scrollHeight, clientHeight } = element;

    console.log('Scroll Top:', scrollTop);
    console.log('Scroll Height:', scrollHeight);
    console.log('Client Height:', clientHeight);

    return scrollTop + clientHeight >= scrollHeight - 500;
};

function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function () {
        const context = this;
        const args = arguments;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function () {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}


window.addSmoothScrollListener = (elementId, dotNetHelper, delay = 100) => {
    const element = document.querySelector(elementId);
    if (!element) {
        console.error(`Element with selector '${elementId}' not found.`);
        return;
    }

    const onScroll = throttle(() => {
        if (window.isScrollBottom(elementId)) {
            dotNetHelper.invokeMethodAsync("OnScrollReachedBottom");
        }
    }, delay);

    element.addEventListener("scroll", onScroll);

    return () => element.removeEventListener("scroll", onScroll);
};

