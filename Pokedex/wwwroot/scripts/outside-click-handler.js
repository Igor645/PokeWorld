function initializeClickOutsideHandler(container, dotNetHelper) {
    let isMouseDownInside = false;

    container.addEventListener("mousedown", function () {
        isMouseDownInside = true;
    });

    document.addEventListener("mouseup", function (event) {
        if (!isMouseDownInside && !container.contains(event.target)) {
            dotNetHelper.invokeMethodAsync("HideDropdown");
        }
        isMouseDownInside = false;
    });
}