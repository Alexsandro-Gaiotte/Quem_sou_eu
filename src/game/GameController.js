import { CHARACTERS, ALL_CHARACTER_NAMES } from './CharacterData.js';
import { sound } from './SoundSystem.js';
import { ComicFX } from './ComicFX.js';

export class GameController {
  constructor(phaserStage) {
    this.phaserStage = phaserStage;
    this.characters = [...CHARACTERS];
    this.currentIndex = 0;
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.currentClueIndex = 0;
    this.isAnsweringLocked = false;
    this.shuffledDeck = [];

    this.bindDOM();
    this.startNewGame();
  }

  bindDOM() {
    this.scoreEl = document.getElementById('hud-score');
    this.streakEl = document.getElementById('hud-streak');
    this.roundEl = document.getElementById('hud-round');
    this.clueEl = document.getElementById('character-clue-text');
    this.cardsContainer = document.getElementById('cards-grid');
    this.soundBtn = document.getElementById('sound-toggle-btn');
    this.hintBtn = document.getElementById('hint-btn');
    this.modalOverlay = document.getElementById('game-modal');
    this.modalRestartBtn = document.getElementById('modal-restart-btn');

    // Mute button handler
    this.soundBtn.addEventListener('click', () => {
      const isMuted = sound.toggleMute();
      this.soundBtn.textContent = isMuted ? '🔇' : '🔊';
      if (!isMuted) sound.playPop();
    });
    this.soundBtn.textContent = sound.isMuted() ? '🔇' : '🔊';

    // Hint button handler
    this.hintBtn.addEventListener('click', () => {
      this.showNextClue();
    });

    // Restart button in modal
    if (this.modalRestartBtn) {
      this.modalRestartBtn.addEventListener('click', () => {
        sound.playPop();
        this.hideModal();
        this.startNewGame();
      });
    }

    // Portal tap sound
    const portal = document.getElementById('character-portal');
    if (portal) {
      portal.addEventListener('click', () => {
        sound.playBoing();
      });
    }
  }

  startNewGame() {
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.currentIndex = 0;
    this.updateHUD();

    // Shuffle characters deck
    this.shuffledDeck = [...this.characters].sort(() => Math.random() - 0.5);

    this.loadRound(0);
  }

  loadRound(index) {
    if (index >= this.shuffledDeck.length) {
      this.triggerGameOver();
      return;
    }

    this.currentIndex = index;
    this.currentClueIndex = 0;
    this.isAnsweringLocked = false;
    const character = this.shuffledDeck[index];

    // Sound effect for round entrance
    sound.playWhoosh();

    // Update Round Indicator
    if (this.roundEl) {
      this.roundEl.textContent = `${index + 1} / ${this.shuffledDeck.length}`;
    }

    // Tell Phaser stage to load character
    if (this.phaserStage) {
      this.phaserStage.loadCharacter(character);
    }

    // Update Clue with Typewriter effect
    this.displayClue(character.clues[0]);

    // Build Cards
    this.renderCards(character);
  }

  displayClue(text) {
    if (!this.clueEl) return;
    this.clueEl.style.opacity = '0';
    this.clueEl.style.transform = 'translateY(6px)';

    setTimeout(() => {
      this.clueEl.textContent = text;
      this.clueEl.style.transition = 'all 0.25s ease';
      this.clueEl.style.opacity = '1';
      this.clueEl.style.transform = 'translateY(0)';
    }, 150);
  }

  showNextClue() {
    if (this.isAnsweringLocked) return;
    const char = this.shuffledDeck[this.currentIndex];
    if (!char) return;

    sound.playPop();
    this.currentClueIndex = (this.currentClueIndex + 1) % char.clues.length;
    this.displayClue(char.clues[this.currentClueIndex]);
  }

  renderCards(correctChar) {
    if (!this.cardsContainer) return;
    this.cardsContainer.innerHTML = '';

    // Collect 3 distractors
    const pool = (correctChar.distractors && correctChar.distractors.length >= 3)
      ? [...correctChar.distractors]
      : ALL_CHARACTER_NAMES.filter(n => n !== correctChar.name);

    const shuffledPool = pool.sort(() => Math.random() - 0.5);
    const chosenDistractors = shuffledPool.slice(0, 3);

    // Combine with correct character and shuffle
    const options = [correctChar.name, ...chosenDistractors].sort(() => Math.random() - 0.5);

    options.forEach(name => {
      const card = document.createElement('button');
      card.className = 'comic-card';
      card.textContent = name;

      card.addEventListener('mouseenter', () => {
        if (!this.isAnsweringLocked) {
          sound.playPop();
        }
      });

      card.addEventListener('click', (e) => {
        this.handleCardSelection(name, card, correctChar, e);
      });

      this.cardsContainer.appendChild(card);
    });
  }

  handleCardSelection(selectedName, cardElement, correctChar, event) {
    if (this.isAnsweringLocked) return;

    const isCorrect = selectedName === correctChar.name;
    const rect = cardElement.getBoundingClientRect();
    const burstX = rect.left + rect.width / 2;
    const burstY = rect.top;

    if (isCorrect) {
      this.isAnsweringLocked = true;
      cardElement.classList.add('correct');

      // Update streaks and score
      this.streak++;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;
      const points = 100 + (this.streak - 1) * 25;
      this.score += points;
      this.updateHUD();

      // Audio feedback
      sound.playCorrect();

      // Comic visual burst (onomatopoeia)
      ComicFX.spawnOnomatopoeia(
        correctChar.onomatopoeia || 'POW!',
        burstX,
        burstY,
        correctChar.accentColor || '#FFD700'
      );

      // Confetti burst
      ComicFX.fireConfetti(correctChar.themeColor);

      // Phaser character celebration animation
      if (this.phaserStage) {
        this.phaserStage.playCelebration();
      }

      // Update speech bubble with character's victory phrase
      this.displayClue(`${correctChar.victoryQuote} ✨ (+${points} pts)`);

      // Disable other cards
      const allCards = this.cardsContainer.querySelectorAll('.comic-card');
      allCards.forEach(c => {
        if (c !== cardElement) c.classList.add('disabled');
      });

      // Proceed to next round after celebration
      setTimeout(() => {
        this.loadRound(this.currentIndex + 1);
      }, 1900);

    } else {
      // Wrong answer
      this.streak = 0;
      this.updateHUD();

      cardElement.classList.add('wrong');
      sound.playWrong();

      // Shake character in Phaser stage
      if (this.phaserStage) {
        this.phaserStage.playShake();
      }

      ComicFX.spawnOnomatopoeia('OPS!', burstX, burstY, '#FF5252');

      // Re-enable card after shake so player can keep guessing
      setTimeout(() => {
        cardElement.classList.remove('wrong');
      }, 600);
    }
  }

  updateHUD() {
    if (this.scoreEl) {
      this.scoreEl.textContent = this.score;
    }
    if (this.streakEl) {
      this.streakEl.textContent = `Combo x${Math.max(1, this.streak)}`;
      if (this.streak >= 2) {
        this.streakEl.classList.add('active-combo');
      } else {
        this.streakEl.classList.remove('active-combo');
      }
    }
  }

  triggerGameOver() {
    sound.playVictory();
    ComicFX.grandVictory();

    // Determine comic title based on score
    let titleBadge = 'Morador Honorário do Limoeiro';
    if (this.score >= 850) {
      titleBadge = 'Dono(a) Supremo da Rua!';
    } else if (this.score >= 700) {
      titleBadge = 'Mestre dos Planos Infalíveis!';
    } else if (this.score >= 500) {
      titleBadge = 'Melhor Amigo da Turma!';
    }

    const modal = document.getElementById('game-modal');
    if (modal) {
      const titleEl = document.getElementById('modal-title');
      const badgeEl = document.getElementById('modal-title-badge');
      const scoreEl = document.getElementById('modal-final-score');
      const streakEl = document.getElementById('modal-best-streak');

      if (titleEl) titleEl.textContent = 'Parabéns!';
      if (badgeEl) badgeEl.textContent = `Você é: ${titleBadge}`;
      if (scoreEl) scoreEl.textContent = this.score;
      if (streakEl) streakEl.textContent = `x${this.bestStreak}`;

      modal.style.display = 'flex';
    }
  }

  hideModal() {
    const modal = document.getElementById('game-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }
}
