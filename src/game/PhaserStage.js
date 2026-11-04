import Phaser from 'phaser';

export class PhaserStage {
  constructor(containerId) {
    this.containerId = containerId;
    this.game = null;
    this.scene = null;
    this.currentCharacter = null;
    this.isShadowMode = true;
    this.isRevealed = false;
    this.idleTween = null;
    this.maskShape = null;
    this.resizeObserver = null;
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

    // Dynamic resize handler: ResizeObserver works for both window resize and responsive layout changes
    if (typeof ResizeObserver !== 'undefined' && container) {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const cr = entry.contentRect;
          if (cr.width > 0 && cr.height > 0) {
            this.handleResize(cr.width, cr.height);
          }
        }
      });
      this.resizeObserver.observe(container);
    } else {
      window.addEventListener('resize', () => {
        if (container) {
          this.handleResize(container.clientWidth || 340, container.clientHeight || 340);
        }
      });
    }
  }

  handleResize(w, h) {
    if (!this.game || !this.scene) return;

    this.game.scale.resize(w, h);

    if (this.characterSprite) {
      this.characterSprite.setPosition(w / 2, h / 2);
      const targetSize = Math.min(w, h) * 0.78;
      this.baseScale = targetSize / Math.max(this.characterSprite.width, this.characterSprite.height);

      if (!this.isRevealed) {
        this.characterSprite.setScale(this.baseScale);
      }

      // Recreate circular mask
      if (this.maskShape) {
        this.maskShape.destroy();
      }
      this.maskShape = this.scene.make.graphics();
      this.maskShape.fillStyle(0xffffff);
      this.maskShape.fillCircle(w / 2, h / 2, targetSize / 2);
      const mask = this.maskShape.createGeometryMask();
      this.characterSprite.setMask(mask);
    }

    if (this.rayGraphics) {
      this.updateSunburstColor();
    }
  }

  createScene() {
    if (!this.scene) return;
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    // Background rays graphics (comic sunburst)
    this.rayGraphics = this.scene.add.graphics();
    this.rayGraphics.setDepth(1);
    this.updateSunburstColor();

    // Continuous rotation for comic action rays
    this.scene.tweens.add({
      targets: this.rayGraphics,
      angle: 360,
      duration: 35000,
      repeat: -1,
      ease: 'Linear'
    });

    // Particle graphics layer
    this.particleGraphics = this.scene.add.graphics();
    this.particleGraphics.setDepth(15);

    // If character was queued before scene was ready
    if (this.pendingCharacter) {
      this.loadCharacter(this.pendingCharacter, this.isShadowMode);
      this.pendingCharacter = null;
    }
  }

  updateSunburstColor() {
    if (!this.scene || !this.rayGraphics) return;
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    if (this.isShadowMode && !this.isRevealed) {
      // Mystery twilight sunburst for shadow mode
      this.drawSunburst(width / 2, height / 2, 0x4A148C, 0xFFD54F, 0.4, 0.15);
    } else {
      const color = this.currentThemeColor || 0xFFD700;
      this.drawSunburst(width / 2, height / 2, color, 0xFFFFFF, 0.35, 0.15);
    }
  }

  drawSunburst(cx, cy, primaryHex, secondaryHex = 0xFFFFFF, alphaPrimary = 0.35, alphaSecondary = 0.15) {
    if (!this.rayGraphics) return;
    this.rayGraphics.clear();
    const numRays = 16;
    const rayLength = Math.max(cx, cy) * 2.5; // Dynamic length for any screen size (20" to 80")
    const angleStep = (Math.PI * 2) / numRays;

    for (let i = 0; i < numRays; i++) {
      const a1 = i * angleStep;
      const a2 = a1 + angleStep * 0.48;

      const isEven = i % 2 === 0;
      const col = isEven ? primaryHex : secondaryHex;
      const alpha = isEven ? alphaPrimary : alphaSecondary;

      this.rayGraphics.fillStyle(col, alpha);
      this.rayGraphics.beginPath();
      this.rayGraphics.moveTo(cx, cy);
      this.rayGraphics.lineTo(cx + Math.cos(a1) * rayLength, cy + Math.sin(a1) * rayLength);
      this.rayGraphics.lineTo(cx + Math.cos(a2) * rayLength, cy + Math.sin(a2) * rayLength);
      this.rayGraphics.closePath();
      this.rayGraphics.fillPath();
    }
  }

  setShadowMode(isShadow) {
    this.isShadowMode = isShadow;
    if (this.characterSprite && !this.isRevealed) {
      if (this.isShadowMode) {
        this.characterSprite.setTintFill(0x181528);
      } else {
        this.characterSprite.clearTint();
      }
      this.updateSunburstColor();
    }
  }

  loadCharacter(item, isShadowMode = true) {
    this.currentCharacter = item;
    this.isShadowMode = isShadowMode;
    this.isRevealed = false;

    if (!this.scene) {
      this.pendingCharacter = item;
      return;
    }

    const key = `item_${item.id}`;
    const hexColor = parseInt(item.themeColor.replace('#', '0x'), 16) || 0xFFD700;
    this.currentThemeColor = hexColor;

    this.updateSunburstColor();

    // Check if texture exists, else load it
    if (!this.scene.textures.exists(key)) {
      const onComplete = () => {
        if (this.scene.textures.exists(key)) {
          this.displayCharacter(key, item);
        } else {
          this.createFallbackTexture(key, item);
          this.displayCharacter(key, item);
        }
      };

      const onError = (fileObj) => {
        if (fileObj.key === key) {
          this.createFallbackTexture(key, item);
          this.displayCharacter(key, item);
        }
      };

      this.scene.load.once('complete', onComplete);
      this.scene.load.once('loaderror', onError);
      this.scene.load.image(key, item.image);
      this.scene.load.start();
    } else {
      this.displayCharacter(key, item);
    }
  }

  createFallbackTexture(key, item) {
    if (!this.scene || this.scene.textures.exists(key)) return;

    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');

    // Comic circle token
    ctx.fillStyle = item.themeColor || '#E62429';
    ctx.beginPath();
    ctx.arc(150, 150, 138, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 10;
    ctx.strokeStyle = '#1E1B18';
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 120px "Bangers", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 150, 140);

    ctx.font = 'bold 24px "Fredoka", Arial, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(item.name.toUpperCase(), 150, 225);

    this.scene.textures.addCanvas(key, canvas);
  }

  displayCharacter(textureKey, item) {
    if (!this.scene) return;
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    if (this.characterSprite) {
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

    const targetSize = Math.min(width, height) * 0.78;
    const baseScale = targetSize / Math.max(sprite.width, sprite.height);
    this.baseScale = baseScale;

    sprite.setScale(0);
    sprite.setAlpha(0);

    // Apply shadow silhouette if in shadow mode
    if (this.isShadowMode && !this.isRevealed) {
      sprite.setTintFill(0x181528);
    } else {
      sprite.clearTint();
    }

    // Circular mask
    if (this.maskShape) {
      this.maskShape.destroy();
    }
    this.maskShape = this.scene.make.graphics();
    this.maskShape.fillStyle(0xffffff);
    this.maskShape.fillCircle(width / 2, height / 2, targetSize / 2);
    const mask = this.maskShape.createGeometryMask();
    sprite.setMask(mask);

    // Bouncy entrance
    this.scene.tweens.add({
      targets: sprite,
      scale: baseScale,
      alpha: 1,
      duration: 650,
      ease: 'Back.easeOut',
      onComplete: () => {
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

    // Tap reaction
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', () => {
      this.playTapReaction();
    });
  }

  // Dramatic Reveal when player guesses correctly!
  revealCharacter() {
    this.isRevealed = true;
    if (!this.scene || !this.characterSprite) return;

    if (this.idleTween) this.idleTween.pause();

    // Step 1: Bright white flash on the silhouette
    this.characterSprite.setTintFill(0xFFFFFF);

    // Step 2: Switch to full color after quick flash
    this.scene.time.delayedCall(120, () => {
      if (this.characterSprite) {
        this.characterSprite.clearTint();
      }
      this.updateSunburstColor();
    });

    // Step 3: Joyous jump & spin celebration
    const originalY = this.scene.scale.height / 2;
    this.scene.tweens.add({
      targets: this.characterSprite,
      y: originalY - 48,
      scaleX: this.baseScale * 1.25,
      scaleY: this.baseScale * 1.25,
      duration: 380,
      yoyo: true,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (this.idleTween) this.idleTween.resume();
      }
    });

    // Spin rays excitedly
    if (this.rayGraphics) {
      this.scene.tweens.add({
        targets: this.rayGraphics,
        angle: this.rayGraphics.angle + 240,
        duration: 900,
        ease: 'Cubic.easeOut'
      });
    }

    // Spawn magical star particles
    this.spawnStarParticles();
  }

  spawnStarParticles() {
    if (!this.scene || !this.particleGraphics) return;
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    const stars = [];
    const colors = [0xFFD700, 0x00E5FF, 0xFF4081, 0xFFFFFF];

    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 80;
      stars.push({
        x: width / 2,
        y: height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1
      });
    }

    let progress = 0;
    const timer = this.scene.time.addEvent({
      delay: 20,
      repeat: 30,
      callback: () => {
        progress += 0.033;
        this.particleGraphics.clear();

        stars.forEach(s => {
          s.x += s.vx * 0.02;
          s.y += s.vy * 0.02;
          s.alpha = Math.max(0, 1 - progress);

          this.particleGraphics.fillStyle(s.color, s.alpha);
          this.particleGraphics.fillCircle(s.x, s.y, s.size * (1 - progress * 0.4));
        });

        if (progress >= 1) {
          this.particleGraphics.clear();
          timer.destroy();
        }
      }
    });
  }

  playCelebration() {
    this.revealCharacter();
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

  playShake() {
    if (!this.scene || !this.characterSprite) return;
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
