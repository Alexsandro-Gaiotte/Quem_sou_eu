import './styles/game.css';
import { PhaserStage } from './game/PhaserStage.js';
import { GameController } from './game/GameController.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize the Phaser 3 Character Stage
  const phaserStage = new PhaserStage('phaser-character-canvas');

  // Initialize the Game Controller
  const gameController = new GameController(phaserStage);

  // Expose to window for debugging or extensions
  window.turmaGame = {
    phaserStage,
    gameController
  };
});
