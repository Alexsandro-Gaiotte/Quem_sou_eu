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

    // Shadow Mode state (default ON, stored in localStorage)
    const canStorage = typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function';
    const storedShadow = canStorage ? localStorage.getItem('quem_sou_eu_shadow_mode') : null;
    this.isShadowMode = storedShadow !== null ? storedShadow === 'true' : true;

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
    this.shadowToggleBtn = document.getElementById('shadow-mode-toggle-btn');
    this.stageBadge = document.getElementById('stage-badge');
    this.hintBtn = document.getElementById('hint-btn');
    this.modalOverlay = document.getElementById('game-modal');
    this.modalRestartBtn = document.getElementById('modal-restart-btn');

    // Mute button handler
    if (this.soundBtn) {
      this.soundBtn.addEventListener('click', () => {
        const isMuted = sound.toggleMute();
        this.soundBtn.textContent = isMuted ? '🔇' : '🔊';
        if (!isMuted) sound.playPop();
      });
      this.soundBtn.textContent = sound.isMuted() ? '🔇' : '🔊';
    }

    // Shadow Mode toggle handler
    if (this.shadowToggleBtn) {
      this.shadowToggleBtn.addEventListener('click', () => {
        this.isShadowMode = !this.isShadowMode;
        if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
          localStorage.setItem('quem_sou_eu_shadow_mode', String(this.isShadowMode));
        }
        this.updateShadowUI();
        if (this.phaserStage) {
          this.phaserStage.setShadowMode(this.isShadowMode);
        }
        sound.playPop();
      });
      this.updateShadowUI();
    }

    // Hint button handler
    if (this.hintBtn) {
      this.hintBtn.addEventListener('click', () => {
        this.showNextClue();
      });
    }

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

  updateShadowUI() {
    if (this.shadowToggleBtn) {
      if (this.isShadowMode) {
        this.shadowToggleBtn.innerHTML = '👤 Sombra: <b>ON</b>';
        this.shadowToggleBtn.classList.add('shadow-mode-active');
        this.shadowToggleBtn.title = 'Modo Sombra ATIVADO: Adivinhe pela silhueta e pelas dicas!';
      } else {
        this.shadowToggleBtn.innerHTML = '☀️ Sombra: <b>OFF</b>';
        this.shadowToggleBtn.classList.remove('shadow-mode-active');
        this.shadowToggleBtn.title = 'Modo Sombra DESATIVADO: Veja a figura colorida!';
      }
    }

    if (this.stageBadge) {
      this.stageBadge.textContent = this.isShadowMode ? '👤 MODO SOMBRA' : '🐾 ANIMAIS & OBJETOS';
    }
  }

  startNewGame() {
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.currentIndex = 0;
    this.updateHUD();

    // Shuffle 8-10 items per match for a punchy game session
    const fullDeck = [...this.characters].sort(() => Math.random() - 0.5);
    this.shuffledDeck = fullDeck.slice(0, 8);

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
    const item = this.shuffledDeck[index];

    // Sound effect
    if (this.isShadowMode) {
      sound.playMystery();
    } else {
      sound.playWhoosh();
    }

    // Update Round Indicator
    if (this.roundEl) {
      this.roundEl.textContent = `${index + 1} / ${this.shuffledDeck.length}`;
    }

    // Update Stage Badge
    if (this.stageBadge) {
      this.stageBadge.textContent = this.isShadowMode ? '👤 MODO SOMBRA' : '🐾 ANIMAIS & OBJETOS';
    }

    // Tell Phaser stage to load item with shadow mode setting
    if (this.phaserStage) {
      this.phaserStage.loadCharacter(item, this.isShadowMode);
    }

    // Display first clue
    this.displayClue(item.clues[0]);

    // Build Cards
    this.renderCards(item);
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
    const item = this.shuffledDeck[this.currentIndex];
    if (!item) return;

    sound.playPop();
    this.currentClueIndex = (this.currentClueIndex + 1) % item.clues.length;
    this.displayClue(item.clues[this.currentClueIndex]);
  }

  renderCards(correctItem) {
    if (!this.cardsContainer) return;
    this.cardsContainer.innerHTML = '';

    // Collect 3 distractors from item's distractor list or general pool
    const pool = (correctItem.distractors && correctItem.distractors.length >= 3)
      ? [...correctItem.distractors]
      : ALL_CHARACTER_NAMES.filter(n => n !== correctItem.name);

    const shuffledPool = pool.sort(() => Math.random() - 0.5);
    const chosenDistractors = shuffledPool.slice(0, 3);

    // Combine with correct item and shuffle
    const options = [correctItem.name, ...chosenDistractors].sort(() => Math.random() - 0.5);

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
        this.handleCardSelection(name, card, correctItem, e);
      });

      this.cardsContainer.appendChild(card);
    });
  }

  handleCardSelection(selectedName, cardElement, correctItem, event) {
    if (this.isAnsweringLocked) return;

    const isCorrect = selectedName === correctItem.name;
    const rect = cardElement.getBoundingClientRect();
    const burstX = rect.left + rect.width / 2;
    const burstY = rect.top;

    if (isCorrect) {
      this.isAnsweringLocked = true;
      cardElement.classList.add('correct');

      // Update streaks and score (shadow mode gives a +50 bonus!)
      this.streak++;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;
      const basePoints = this.isShadowMode ? 150 : 100;
      const points = basePoints + (this.streak - 1) * 25;
      this.score += points;
      this.updateHUD();

      // Audio feedback (sparkle reveal + chime)
      if (this.isShadowMode) {
        sound.playReveal();
      }
      sound.playCorrect();

      // Dramatic reveal animation in Phaser stage
      if (this.phaserStage) {
        this.phaserStage.revealCharacter();
      }

      // Update badge to reveal item's title
      if (this.stageBadge) {
        this.stageBadge.textContent = `✨ ${correctItem.name.toUpperCase()}!`;
      }

      // Comic visual burst (onomatopoeia)
      const onom = this.isShadowMode ? 'REVELADO!' : (correctItem.onomatopoeia || 'POW!');
      ComicFX.spawnOnomatopoeia(
        onom,
        burstX,
        burstY,
        correctItem.accentColor || '#FFD700'
      );

      // Confetti burst
      ComicFX.fireConfetti(correctItem.themeColor);

      // Update speech bubble with victory quote
      this.displayClue(`${correctItem.victoryQuote} ✨ (+${points} pts)`);

      // Disable other cards
      const allCards = this.cardsContainer.querySelectorAll('.comic-card');
      allCards.forEach(c => {
        if (c !== cardElement) c.classList.add('disabled');
      });

      // Proceed to next round after celebration
      setTimeout(() => {
        this.loadRound(this.currentIndex + 1);
      }, 2100);

    } else {
      // Wrong answer
      this.streak = 0;
      this.updateHUD();

      cardElement.classList.add('wrong');
      sound.playWrong();

      // Shake silhouette in Phaser stage
      if (this.phaserStage) {
        this.phaserStage.playShake();
      }

      ComicFX.spawnOnomatopoeia('OPS!', burstX, burstY, '#FF5252');

      // Re-enable card after shake
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

    let titleBadge = 'Amigo dos Animais & Objetos';
    if (this.score >= 1200) {
      titleBadge = 'Mestre Supremo dos Enigmas!';
    } else if (this.score >= 900) {
      titleBadge = 'Detetive das Sombras!';
    } else if (this.score >= 650) {
      titleBadge = 'Grande Adivinhador!';
    }

    const modal = document.getElementById('game-modal');
    if (modal) {
      const titleEl = document.getElementById('modal-title');
      const badgeEl = document.getElementById('modal-title-badge');
      const scoreEl = document.getElementById('modal-final-score');
      const streakEl = document.getElementById('modal-best-streak');

      if (titleEl) titleEl.textContent = 'Parabéns!';
      if (badgeEl) badgeEl.textContent = `Título: ${titleBadge}`;
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
