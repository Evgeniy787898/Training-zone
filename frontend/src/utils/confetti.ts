/**
 * Запускает анимацию конфетти
 * Легковесная реализация без внешних зависимостей
 */

const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ff6b35', '#f7931e', '#fdc82f'];
const emojis = ['🎉', '✨', '⭐', '💫', '🌟', '🎊'];

function randomInRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

function createParticle(x: number, y: number, useEmoji: boolean = false): HTMLDivElement {
    const particle = document.createElement('div');
    particle.style.position = 'fixed';
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.pointerEvents = 'none';
    particle.style.zIndex = '9999';
    particle.style.userSelect = 'none';

    if (useEmoji) {
        particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        particle.style.fontSize = `${randomInRange(20, 40)}px`;
    } else {
        particle.style.width = `${randomInRange(6, 12)}px`;
        particle.style.height = `${randomInRange(6, 12)}px`;
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    }

    return particle;
}

function animateParticle(particle: HTMLDivElement, angle: number, velocity: number, gravity: number): void {
    const startX = parseFloat(particle.style.left);
    const startY = parseFloat(particle.style.top);
    const startTime = Date.now();
    const duration = randomInRange(1000, 2000);
    const rotation = randomInRange(-720, 720);
    const drift = randomInRange(-50, 50);

    function update() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        if (progress >= 1) {
            particle.remove();
            return;
        }

        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity - gravity * elapsed / 1000;

        const x = startX + vx * elapsed / 16 + drift * progress;
        const y = startY + vy * elapsed / 16 + gravity * Math.pow(elapsed / 1000, 2) * 50;
        const opacity = 1 - progress;
        const rotate = rotation * progress;

        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.opacity = `${opacity}`;
        particle.style.transform = `rotate(${rotate}deg)`;

        requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
}

export function launchConfetti(options: {
    origin?: { x: number; y: number };
    particleCount?: number;
    spread?: number;
    useEmoji?: boolean;
} = {}): void {
    const {
        origin = { x: window.innerWidth / 2, y: window.innerHeight / 2 },
        particleCount = 80,
        spread = 100,
        useEmoji = true,
    } = options;

    for (let i = 0; i < particleCount; i++) {
        const particle = createParticle(origin.x, origin.y, useEmoji && i % 2 === 0);
        document.body.appendChild(particle);

        const angle = randomInRange(-Math.PI / 2 - spread / 100, -Math.PI / 2 + spread / 100);
        const velocity = randomInRange(3, 8);
        const gravity = randomInRange(0.5, 1.5);

        animateParticle(particle, angle, velocity, gravity);
    }
}

/**
 * Запускает эффектное конфетти с нескольких точек
 */
export function celebrateWithConfetti(): void {
    // Центральный взрыв
    launchConfetti({
        origin: { x: window.innerWidth / 2, y: window.innerHeight / 3 },
        particleCount: 60,
        spread: 80,
        useEmoji: true,
    });

    // Боковые взрывы
    setTimeout(() => {
        launchConfetti({
            origin: { x: window.innerWidth * 0.25, y: window.innerHeight / 2 },
            particleCount: 40,
            spread: 60,
            useEmoji: true,
        });
        launchConfetti({
            origin: { x: window.innerWidth * 0.75, y: window.innerHeight / 2 },
            particleCount: 40,
            spread: 60,
            useEmoji: true,
        });
    }, 150);
}

