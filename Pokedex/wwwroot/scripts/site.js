function startPokeballAnimation(pokeballs) {
    const minVerticalSpacing = 200;
    const maxAttempts = 100;
    const recentYPositions = [];
    const maxPokeballs = 6;

    function getRandomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    function createPokeballElement(pokeball) {
        const img = document.createElement('img');
        img.src = pokeball.sprites.default;
        img.classList.add('pokeball');
        img.style.position = 'fixed';
        img.style.zIndex = '0';
        img.style.pointerEvents = 'none';
        img.style.opacity = getRandomInRange(0.7, 1);
        document.body.appendChild(img);
        return img;
    }

    function getNonClusteringYPosition() {
        let yPosition;
        let isTooClose;
        let attempts = 0;
        do {
            yPosition = getRandomInRange(0, window.innerHeight - 170);
            isTooClose = recentYPositions.some(pos => Math.abs(pos - yPosition) < minVerticalSpacing);
            attempts++;
        } while (isTooClose && attempts < maxAttempts);
        recentYPositions.push(yPosition);
        if (recentYPositions.length > 5) {
            recentYPositions.shift();
        }
        return yPosition;
    }

    function animatePokeball(pokeball, initialX, initialY) {
        const img = createPokeballElement(pokeball);
        const size = getRandomInRange(120, 170);
        const speed = getRandomInRange(0.2, 0.4);
        const rotationSpeed = getRandomInRange(10, 40);

        img.style.width = `${size}px`;
        img.style.height = `${size}px`;
        img.style.top = `${initialY}px`;
        img.style.left = `${initialX}px`;

        let start = null;
        function step(timestamp) {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            const xPosition = (progress / 1000) * speed * 100;
            img.style.transform = `translateX(${xPosition}px) rotate(${(progress / 1000) * rotationSpeed}deg)`;

            if (xPosition < window.innerWidth + size * 1.1) {
                requestAnimationFrame(step);
            } else {
                img.remove();
            }
        }
        requestAnimationFrame(step);
    }

    function startAnimation() {
        if (pokeballs.length === 0) {
            return;
        }
        const randomIndex = Math.floor(Math.random() * pokeballs.length);
        const initialY = getNonClusteringYPosition();
        animatePokeball(pokeballs[randomIndex], -170, initialY);
        const randomDelay = getRandomInRange(6000, 8000);
        setTimeout(startAnimation, randomDelay);
    }

    for (let i = 0; i < maxPokeballs; i++) {
        const randomIndex = Math.floor(Math.random() * pokeballs.length);
        const initialX = getRandomInRange(0, window.innerWidth - 170);
        const initialY = getNonClusteringYPosition();
        animatePokeball(pokeballs[randomIndex], initialX, initialY);
    }

    startAnimation();
}
