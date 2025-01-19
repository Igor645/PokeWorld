function startPokeballAnimation(pokeballs) {
    const minHorizontalSpacing = 200;
    const maxAttempts = 100;
    const recentXPositions = [];
    const maxPokeballs = 10;
    let animationFrameId;
    let timeoutId;

    console.log("start")

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
        img.style.opacity = getRandomInRange(1, 1);
        document.body.appendChild(img);
        return img;
    }

    function getNonClusteringXPosition() {
        let xPosition;
        let isTooClose;
        let attempts = 0;
        do {
            xPosition = getRandomInRange(0, window.innerWidth - 170);
            isTooClose = recentXPositions.some(pos => Math.abs(pos - xPosition) < minHorizontalSpacing);
            attempts++;
        } while (isTooClose && attempts < maxAttempts);
        recentXPositions.push(xPosition);
        if (recentXPositions.length > 5) {
            recentXPositions.shift();
        }
        return xPosition;
    }

    function animatePokeball(pokeball, initialX, initialY) {
        const img = createPokeballElement(pokeball);
        const size = getRandomInRange(120, 170);
        const speed = getRandomInRange(0.2, 0.4);
        const rotationSpeed = getRandomInRange(10, 40);

        img.style.width = `${size}px`;
        img.style.height = `${size}px`;
        img.style.left = `${initialX}px`;
        img.style.bottom = `${initialY}px`;

        let start = null;
        function step(timestamp) {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            const yPosition = (progress / 1000) * speed * 100;
            img.style.transform = `translateY(-${yPosition}px) rotate(${(progress / 1000) * rotationSpeed}deg)`;

            if (yPosition < window.innerHeight + size * 1.4) {
                animationFrameId = requestAnimationFrame(step);
            } else {
                img.remove();
            }
        }
        animationFrameId = requestAnimationFrame(step);
    }

    function startAnimation() {
        if (pokeballs.length === 0) {
            return;
        }
        const randomIndex = Math.floor(Math.random() * pokeballs.length);
        const initialX = getNonClusteringXPosition();
        animatePokeball(pokeballs[randomIndex], initialX, -170);
        const randomDelay = getRandomInRange(2000, 4000);
        timeoutId = setTimeout(startAnimation, randomDelay);
    }

    function pauseAnimation() {
        cancelAnimationFrame(animationFrameId);
        clearTimeout(timeoutId);
    }

    function resumeAnimation() {
        startAnimation();
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            pauseAnimation();
        } else {
            resumeAnimation();
        }
    });

    for (let i = 0; i < maxPokeballs; i++) {
        const randomIndex = Math.floor(Math.random() * pokeballs.length);
        const initialX = getNonClusteringXPosition();
        const initialY = getRandomInRange(0, window.innerHeight - 170);
        animatePokeball(pokeballs[randomIndex], initialX, initialY);
    }

    startAnimation();
}

