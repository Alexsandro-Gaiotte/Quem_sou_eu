import confetti from 'canvas-confetti';

export class ComicFX {
  // Spawn explosive comic onomatopoeia popup
  static spawnOnomatopoeia(text, x, y, color = '#FFD700') {
    const el = document.createElement('div');
    el.className = 'comic-burst-fx';
    el.innerText = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.borderColor = '#111';
    el.style.backgroundColor = color;

    // Random slight rotation for authentic comic book flair
    const rot = (Math.random() * 24 - 12).toFixed(1);
    el.style.setProperty('--rot', `${rot}deg`);

    document.body.appendChild(el);

    setTimeout(() => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 1100);
  }

  // Trigger character-themed confetti explosion
  static fireConfetti(colorHex = '#E62429') {
    const colors = [colorHex, '#FFD700', '#FFFFFF', '#00E5FF'];

    // Dual burst from left and right
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 65,
      origin: { x: 0.15, y: 0.65 },
      colors
    });

    confetti({
      particleCount: 50,
      angle: 120,
      spread: 65,
      origin: { x: 0.85, y: 0.65 },
      colors
    });

    // Center starburst
    setTimeout(() => {
      confetti({
        particleCount: 40,
        spread: 100,
        origin: { x: 0.5, y: 0.45 },
        shapes: ['circle', 'square'],
        colors
      });
    }, 120);
  }

  // Grand celebration for quiz victory
  static grandVictory() {
    const duration = 2.5 * 1000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#E62429', '#2E8B57', '#FFD600', '#1E88E5', '#FF9800']
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#E62429', '#2E8B57', '#FFD600', '#1E88E5', '#FF9800']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }
}
