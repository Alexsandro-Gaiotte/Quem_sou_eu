import Phaser from 'phaser';

export class PhaserStage {
  constructor(containerId) {
    this.containerId = containerId;
    this.game = null;
    this.scene = null;
    this.currentCharacter = null;
    this.initGame();
  }

  initGame() {
    const container = document.getElementById(this.containerId);
    const width = container ? container.clientWidth || 340 : 340;
    const height = container ? container.clientHeight || 340 : 340;

    const self = this;

    const config = {
      type: Phaser.AUTO,
      parent: this.containerId,
      width: width,
      height: height,
      transparent: true,
      physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 } }
      },
      scene: {
        preload: function () {
          self.scene = this;
        },
        create: function () {
          self.scene = this;
          self.createScene();
        }
      }
    };

    this.game = new Phaser.Game(config);

    window.addEventListener('resize', () => {
      if (this.game && container) {
        const w = container.clientWidth || 340;
        const h = container.clientHeight || 340;
        this.game.scale.resize(w, h);
        if (this.characterSprite) {
          this.characterSprite.setPosition(w / 2, h / 2);
        }
        if (this.rayGraphics) {
          this.drawSunburst(w / 2, h / 2, this.currentThemeColor || 0xFFD700);
        }
      }
    });
  }

  createScene() {
    if (!this.scene) return;
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    // Background rays graphics (comic sunburst)
    this.rayGraphics = this.scene.add.graphics();
    this.rayGraphics.setDepth(1);
    this.drawSunburst(width / 2, height / 2, 0xFFE082);

    // Continuous rotation for comic action rays
    this.scene.tweens.add({
      targets: this.rayGraphics,
      angle: 360,
      duration: 35000,
      repeat: -1,
      ease: 'Linear'
    });

    // Sparkle / star particles container
    this.particleGraphics = this.scene.add.graphics();
    this.particleGraphics.setDepth(2);

    // If character was set before scene was ready
    if (this.pendingCharacter) {
      this.loadCharacter(this.pendingCharacter);
      this.pendingCharacter = null;
    }
  }

  drawSunburst(cx, cy, colorHex) {
    if (!this.rayGraphics) return;
    this.rayGraphics.clear();
    const numRays = 16;
    const rayLength = 320;
    const angleStep = (Math.PI * 2) / numRays;

    for (let i = 0; i < numRays; i++) {
      const a1 = i * angleStep;
      const a2 = a1 + angleStep * 0.45;

      const alpha = i % 2 === 0 ? 0.35 : 0.15;
      this.rayGraphics.fillStyle(colorHex, alpha);
      this.rayGraphics.beginPath();
      this.rayGraphics.moveTo(cx, cy);
      this.rayGraphics.lineTo(cx + Math.cos(a1) * rayLength, cy + Math.sin(a1) * rayLength);
      this.rayGraphics.lineTo(cx + Math.cos(a2) * rayLength, cy + Math.sin(a2) * rayLength);
      this.rayGraphics.closePath();
      this.rayGraphics.fillPath();
    }
  }

  loadCharacter(character) {
    this.currentCharacter = character;
    if (!this.scene) {
      this.pendingCharacter = character;
      return;
    }

    const key = `char_${character.id}`;
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    const hexColor = parseInt(character.themeColor.replace('#', '0x'), 16) || 0xFFD700;
    this.currentThemeColor = hexColor;
    this.drawSunburst(width / 2, height / 2, hexColor);

    // Load texture dynamically if not already loaded
    if (!this.scene.textures.exists(key)) {
      const onComplete = () => {
        if (this.scene.textures.exists(key)) {
          this.displayCharacter(key, character);
        } else {
          this.createFallbackTexture(key, character);
          this.displayCharacter(key, character);
        }
      };

      const onError = (fileObj) => {
        if (fileObj.key === key) {
          // If .png failed, try .jpg as fallback
          if (character.image.endsWith('.png')) {
            const altPath = character.image.replace('.png', '.jpg');
            this.scene.load.image(key, altPath);
            return;
          }
          // If still failing, create comic placeholder texture
          this.createFallbackTexture(key, character);
          this.displayCharacter(key, character);
        }
      };

      this.scene.load.once('complete', onComplete);
      this.scene.load.once('loaderror', onError);
      this.scene.load.image(key, character.image);
      this.scene.load.start();
    } else {
      this.displayCharacter(key, character);
    }
  }

  createFallbackTexture(key, character) {
    if (!this.scene || this.scene.textures.exists(key)) return;

    // Generate dynamic comic placeholder texture
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');

    // Background circle with theme color
    ctx.fillStyle = character.themeColor || '#E62429';
    ctx.beginPath();
    ctx.arc(150, 150, 140, 0, Math.PI * 2);
    ctx.fill();

    // Dark comic border
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#1E1B18';
    ctx.stroke();

    // Comic Question Mark or First Initial
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 120px "Bangers", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 150, 140);

    // Character Name at bottom of token
    ctx.font = 'bold 24px "Fredoka", Arial, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(character.name.toUpperCase(), 150, 220);

    this.scene.textures.addCanvas(key, canvas);
  }

  displayCharacter(textureKey, character) {
    if (!this.scene) return;
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    if (this.characterSprite) {
      // Fade and scale out old sprite
      const oldSprite = this.characterSprite;
      this.scene.tweens.add({
        targets: oldSprite,
        alpha: 0,
        scale: 0.4,
        duration: 250,
        onComplete: () => {
          oldSprite.destroy();
        }
      });
    }

    // Create new sprite
    const sprite = this.scene.add.sprite(width / 2, height / 2, textureKey);
    sprite.setDepth(10);
    this.characterSprite = sprite;

    // Scale to fit nicely in 260x260 circular comic viewport
    const targetSize = Math.min(width, height) * 0.78;
    const scale = targetSize / Math.max(sprite.width, sprite.height);
    sprite.setScale(0);
    sprite.setAlpha(0);

    // Circular mask with comic border
    const maskShape = this.scene.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillCircle(width / 2, height / 2, targetSize / 2);
    const mask = maskShape.createGeometryMask();
    sprite.setMask(mask);

    // Bouncy comic entrance tween
    this.scene.tweens.add({
      targets: sprite,
      scale: scale,
      alpha: 1,
      duration: 650,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Idle breathing / floating motion
        if (this.idleTween) this.idleTween.stop();
        this.idleTween = this.scene.tweens.add({
          targets: sprite,
          y: height / 2 - 8,
          duration: 1800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
    });

    // Make character interactive to touch/click
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', () => {
      this.playTapReaction();
    });
  }

  playTapReaction() {
    if (!this.scene || !this.characterSprite) return;
    this.scene.tweens.add({
      targets: this.characterSprite,
      scaleX: this.characterSprite.scaleX * 1.15,
      scaleY: this.characterSprite.scaleY * 0.88,
      duration: 120,
      yoyo: true,
      ease: 'Quad.easeInOut'
    });
  }

  playCelebration() {
    if (!this.scene || !this.characterSprite) return;

    if (this.idleTween) this.idleTween.pause();

    // High jump, 360 spin & joyful scale
    const originalY = this.scene.scale.height / 2;
    this.scene.tweens.add({
      targets: this.characterSprite,
      y: originalY - 45,
      scaleX: this.characterSprite.scaleX * 1.25,
      scaleY: this.characterSprite.scaleY * 1.25,
      duration: 350,
      yoyo: true,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (this.idleTween) this.idleTween.resume();
      }
    });

    // Speed up background ray rotation during victory
    if (this.rayGraphics) {
      this.scene.tweens.add({
        targets: this.rayGraphics,
        angle: this.rayGraphics.angle + 180,
        duration: 800,
        ease: 'Cubic.easeOut'
      });
    }
  }

  playShake() {
    if (!this.scene || !this.characterSprite) return;

    // Comic dizzy shake
    const currentX = this.characterSprite.x;
    this.scene.tweens.add({
      targets: this.characterSprite,
      x: currentX - 14,
      duration: 60,
      yoyo: true,
      repeat: 4,
      ease: 'Linear',
      onComplete: () => {
        this.characterSprite.x = currentX;
      }
    });
  }
}
