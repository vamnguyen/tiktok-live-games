/**
 * game.js - Boss Raid Game Logic (Phaser 3 Edition)
 */

class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: "MainScene" });
    this.players = new Map(); // uniqueId -> Container
    this.boss = null;
    this.socket = null;
    this.streamerUsername = null;
    this.isGameOver = false;
  }

  preload() {
    // No external assets
  }

  create() {
    console.log("[Phaser] Game Created");

    // 0. Visual Setup
    this.generateTextures();
    this.cameras.main.setBackgroundColor("#1a1a2e"); // Dark Space Blue

    // stars background
    this.createStarfield();

    // 1. Setup Socket.io
    this.setupSocket();

    // 2. Create Boss
    this.createBoss();

    // 3. Input handling (Debug)
    this.input.keyboard.on("keydown-D", () => {
      if (this.boss) this.damageBoss(500);
    });

    // Debug: Join fake player
    this.input.keyboard.on("keydown-J", () => {
      this.handlePlayerJoin({
        user: {
          uniqueId: "test_user_" + Date.now(),
          nickname: "Tester",
          profilePictureUrl: "",
        },
      });
    });

    // Debug: Gifts
    this.input.keyboard.on("keydown-S", () => {
      this.handleGift({
        user: { uniqueId: "debug_user", nickname: "DebugUser" },
        giftName: "Rose",
        giftType: "small",
        repeatCount: 1,
      });
    });
    this.input.keyboard.on("keydown-M", () => {
      this.handleGift({
        user: { uniqueId: "debug_user", nickname: "DebugUser" },
        giftName: "Donut",
        giftType: "medium",
        repeatCount: 10,
      });
    });
    this.input.keyboard.on("keydown-L", () => {
      this.handleGift({
        user: { uniqueId: "debug_user", nickname: "DebugUser" },
        giftName: "Lion",
        giftType: "large",
        repeatCount: 1,
      });
    });
  }

  generateTextures() {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(4, 4, 4);
    graphics.generateTexture("particle", 8, 8);
  }

  createStarfield() {
    const { width, height } = this.scale;
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const alpha = Math.random();
      this.add.circle(x, y, 1, 0xffffff, alpha);
    }
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================

  setupSocket() {
    this.socket = io();
    this.streamerUsername = this.getUsernameFromURL();

    if (this.streamerUsername) {
      this.socket.emit("join-room", this.streamerUsername);
      const statusText = document.getElementById("statusText");
      if (statusText)
        statusText.textContent = `Connecting: @${this.streamerUsername}`;
    }

    // Socket Events
    this.socket.on("room-joined", (data) => {
      const statusText = document.getElementById("statusText");
      const statusDot = document.getElementById("statusDot");
      if (statusText)
        statusText.textContent = `Connected: @${this.streamerUsername}`;
      if (statusDot) statusDot.classList.add("connected");
    });

    this.socket.on("chat", (data) => this.handleChat(data));
    this.socket.on("player_join", (data) => this.handlePlayerJoin(data));
    this.socket.on("player_attack", (data) => this.handlePlayerAttack(data));
    this.socket.on("gift_received", (data) => this.handleGift(data));
  }

  getUsernameFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("id") || null;
  }

  // ==========================================
  // GAME OBJECTS
  // ==========================================

  createBoss() {
    const { width, height } = this.scale;

    this.boss = this.add.container(width / 2, height / 2);
    this.boss.maxHp = 50000; // Increased HP for raid feel
    this.boss.currentHp = 50000;
    this.boss.radius = 100;

    // Boss Sprite (Emoji)
    const bossText = this.add
      .text(0, 0, "👹", { fontSize: "150px" })
      .setOrigin(0.5);

    // HP Bar
    const hpBg = this.add.rectangle(0, -100, 300, 30, 0x000000, 0.8);
    const hpFill = this.add.rectangle(-150, -100, 300, 30, 0xff0000);
    hpFill.setOrigin(0, 0.5);

    // Boss Name
    const nameText = this.add
      .text(0, -140, "RAID BOSS", {
        fontSize: "32px",
        fontFamily: "Segoe UI",
        fontStyle: "bold",
        color: "#ff4444",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    // HP Text
    const hpText = this.add
      .text(0, -100, "50000", {
        fontSize: "18px",
        fontFamily: "monospace",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.boss.add([bossText, hpBg, hpFill, nameText, hpText]);

    this.boss.hpFill = hpFill;
    this.boss.hpText = hpText;
    this.boss.sprite = bossText;

    this.physics.add.existing(this.boss);
    this.boss.body.setCircle(80);
    this.boss.body.setImmovable(true);
  }

  // ==========================================
  // PLAYER MANAGMENT
  // ==========================================

  handlePlayerJoin(data) {
    if (this.isGameOver) return;
    const { user } = data;
    if (this.players.has(user.uniqueId)) return;

    // Random pos
    const angle = Math.random() * Math.PI * 2;
    const distance = 350;
    const x = this.boss.x + Math.cos(angle) * distance;
    const y = this.boss.y + Math.sin(angle) * distance;

    const player = this.add.container(x, y);
    player.uniqueId = user.uniqueId;
    player.nickname = user.nickname;
    player.damageDealt = 0;

    // Avatar
    const bgCircle = this.add.circle(0, 0, 32, 0xffffff);
    player.add(bgCircle);

    const key = `avatar_${user.uniqueId}`;
    if (user.profilePictureUrl) {
      this.load.image(key, user.profilePictureUrl);
      this.load.once("filecomplete-image-" + key, () => {
        const avatarSprite = this.add.image(0, 0, key);
        avatarSprite.setDisplaySize(60, 60);
        // Simple mask
        const shape = this.make.graphics();
        shape.fillCircle(x, y, 30);
        // Masking in containers is complex, skipping mask for performance/simplicity
        // Just add image
        player.add(avatarSprite);
        bgCircle.destroy();
        player.sendToBack(avatarSprite);
      });
      this.load.start();
    } else {
      const emoji = this.add
        .text(0, 0, "👤", { fontSize: "40px" })
        .setOrigin(0.5);
      player.add(emoji);
    }

    // Name
    const nameText = this.add
      .text(0, 45, user.nickname.substring(0, 10), {
        fontSize: "14px",
        fontFamily: "Segoe UI",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    player.add([nameText]);
    player.spriteObject = bgCircle; // Ref for scaling

    this.physics.add.existing(player);
    this.players.set(user.uniqueId, player);

    this.createExplosionEffect(x, y, 0x00ff88, 10, false);

    const hint = document.getElementById("joinHint");
    if (hint) hint.style.display = "none";
    this.updateLeaderboard();
  }

  handleChat(data) {
    if (this.isGameOver) return;
    const { user, comment } = data;
    const msg = comment.toLowerCase().trim();

    // Auto join
    if (!this.players.has(user.uniqueId)) {
      // join on any interaction
      this.handlePlayerJoin({ user });
    }

    if (["hit", "attack", "chem", "danh"].some((k) => msg.includes(k))) {
      this.handlePlayerAttack({ user, damage: 100 });
    }
  }

  // ==========================================
  // ACTIONS
  // ==========================================

  handlePlayerAttack(data) {
    if (this.isGameOver) return;
    const { user, damage } = data;
    let player = this.players.get(user.uniqueId);

    if (!player) {
      this.handlePlayerJoin({ user });
      return; // Wait for join
    }

    // Attack Animation
    const attackText = this.add
      .text(player.x, player.y - 30, "⚔️", { fontSize: "24px" })
      .setOrigin(0.5);
    this.tweens.add({
      targets: attackText,
      y: player.y - 60,
      alpha: 0,
      duration: 400,
      onComplete: () => attackText.destroy(),
    });

    // Projectile
    const projectile = this.add
      .text(player.x, player.y, "🔥", { fontSize: "24px" })
      .setOrigin(0.5);
    this.physics.add.existing(projectile);
    this.physics.moveToObject(projectile, this.boss, 600);

    // Rotation
    const angle = Phaser.Math.Angle.Between(
      player.x,
      player.y,
      this.boss.x,
      this.boss.y
    );
    projectile.rotation = angle + 1.57;

    // Hit Logic
    this.physics.add.overlap(projectile, this.boss, (proj, boss) => {
      proj.destroy();
      this.damageBoss(damage);
      this.createExplosionEffect(proj.x, proj.y, 0xffaa00, 8, false);

      player.damageDealt += damage;
      this.updateLeaderboard();
    });

    this.time.delayedCall(1500, () => {
      if (projectile.active) projectile.destroy();
    });
  }

  handleGift(data) {
    if (this.isGameOver) return;
    const { user, giftName, giftType, repeatCount } = data;

    if (!this.players.has(user.uniqueId)) {
      this.handlePlayerJoin({ user });
    }
    const player = this.players.get(user.uniqueId);

    // 1. Buff Player
    if (player) {
      // Heal / Scale Up
      this.tweens.add({
        targets: player,
        scale: 1.3,
        duration: 200,
        yoyo: true,
      });

      const buffText = this.add
        .text(player.x, player.y - 50, "💪 BUFF!", {
          fontSize: "18px",
          color: "#00ff00",
          stroke: "#000",
          strokeThickness: 4,
        })
        .setOrigin(0.5);
      this.tweens.add({
        targets: buffText,
        y: player.y - 100,
        alpha: 0,
        duration: 1000,
      });

      // Bonus Damage
      const damage =
        (giftType === "large" ? 5000 : giftType === "medium" ? 1000 : 200) *
        repeatCount;
      player.damageDealt += damage;
      this.updateLeaderboard();

      // Damage Boss immediately (Magic Damage)
      this.damageBoss(damage);
      this.showFloatingText(
        this.boss.x,
        this.boss.y - 50,
        `-${damage}`,
        0xff00ff
      );
    }

    // 2. Global Effects
    if (giftType === "large" || repeatCount >= 10) {
      // ULTIMATE
      this.triggerGlobalAttack(user, giftName);
    } else {
      // Standard Effect
      this.showFloatingText(
        player ? player.x : 0,
        player ? player.y - 80 : 0,
        `🎁 ${giftName}`,
        0xffd700
      );
    }
  }

  triggerGlobalAttack(user, giftName) {
    // Screen Shake
    this.cameras.main.shake(1000, 0.05);
    this.cameras.main.flash(500, 255, 255, 255);

    const text = this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2,
        `${user.nickname}\nUSED ${giftName.toUpperCase()}!`,
        {
          fontSize: "48px",
          fontFamily: "Arial Black",
          align: "center",
          color: "#ffd700",
          stroke: "#000",
          strokeThickness: 8,
        }
      )
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: text,
      alpha: 1,
      scale: 1.5,
      duration: 500,
      yoyo: true,
      hold: 1000,
      onComplete: () => text.destroy(),
    });

    // Massive Explosion
    this.createExplosionEffect(this.boss.x, this.boss.y, 0xff00ff, 100, true);
  }

  // ==========================================
  // LOGIC & SYSTEMS
  // ==========================================

  damageBoss(amount) {
    if (this.isGameOver) return;

    this.boss.currentHp = Math.max(0, this.boss.currentHp - amount);
    this.updateBossHpBar();

    // Visuals
    this.boss.sprite.setTint(0xff0000);
    this.time.delayedCall(100, () => this.boss.sprite.clearTint());

    // Shake
    this.tweens.add({
      targets: this.boss,
      x: this.boss.x + (Math.random() - 0.5) * 15,
      y: this.boss.y + (Math.random() - 0.5) * 15,
      duration: 50,
      yoyo: true,
      repeat: 1,
    });

    if (this.boss.currentHp <= 0) this.bossDeath();
  }

  updateBossHpBar() {
    const percent = this.boss.currentHp / this.boss.maxHp;
    this.boss.hpFill.width = 300 * percent;
    this.boss.hpText.setText(`${Math.floor(this.boss.currentHp)}`);
  }

  bossDeath() {
    this.isGameOver = true;
    this.boss.sprite.setText("💀");
    this.createExplosionEffect(this.boss.x, this.boss.y, 0xff0000, 200, true);
    this.cameras.main.shake(1000, 0.05);

    // Victory Screen
    const { width, height } = this.scale;
    const bg = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
      .setDepth(100);
    const winText = this.add
      .text(width / 2, height / 2 - 50, "VICTORY!", {
        fontSize: "80px",
        fontFamily: "Arial Black",
        color: "#ffd700",
        stroke: "#ff4400",
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setDepth(101);

    const subText = this.add
      .text(width / 2, height / 2 + 50, "BOSS DEFEATED", {
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(101);

    // Spawn confettis
    this.time.addEvent({
      delay: 100,
      callback: () => {
        this.createExplosionEffect(
          Math.random() * width,
          Math.random() * height,
          Phaser.Display.Color.RandomRGB().color,
          10,
          false
        );
      },
      repeat: 50,
    });
  }

  updateLeaderboard() {
    const leaderboardList = document.getElementById("leaderboardList");
    if (!leaderboardList) return;

    const sorted = Array.from(this.players.values())
      .sort((a, b) => b.damageDealt - a.damageDealt)
      .slice(0, 5);

    if (sorted.length === 0) {
      leaderboardList.innerHTML =
        '<p style="color:rgba(255,255,255,0.5);text-align:center">Waiting...</p>';
      return;
    }

    leaderboardList.innerHTML = sorted
      .map(
        (p, index) => `
          <div class="leaderboard-item">
            <div class="leaderboard-rank" style="background: ${
              index < 3 ? "" : "#444"
            }; ${
          index === 0
            ? "background:linear-gradient(135deg,#ffd700,#ffaa00)"
            : ""
        }">${index + 1}</div>
            <div class="leaderboard-info">
                <div class="leaderboard-name" style="color:white">${
                  p.nickname
                }</div>
                <div class="leaderboard-damage">⚔️ ${this.formatNumber(
                  p.damageDealt
                )}</div>
            </div>
          </div>
      `
      )
      .join("");
  }

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num;
  }

  // ==========================================
  // VFX
  // ==========================================

  createExplosionEffect(x, y, color, count, large) {
    const particles = this.add.particles(x, y, "particle", {
      speed: { min: 50, max: large ? 400 : 200 },
      scale: { start: large ? 1 : 0.4, end: 0 },
      blendMode: "ADD",
      lifespan: large ? 1000 : 600,
      tint: color,
      quantity: count,
      emitting: false,
    });
    particles.explode(count);
  }

  showFloatingText(x, y, message, color) {
    const text = this.add
      .text(x, y, message, {
        fontSize: "24px",
        fontFamily: "Arial Black",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    text.setTint(color);

    this.tweens.add({
      targets: text,
      y: y - 80,
      alpha: 0,
      duration: 1200,
      ease: "Power2",
      onComplete: () => text.destroy(),
    });
  }
}

const config = {
  type: Phaser.AUTO,
  parent: "gameContainer",
  width: window.innerWidth,
  height: window.innerHeight,
  transparent: false, // Opaque background for dark theme
  backgroundColor: "#1a1a2e",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: MainScene,
};

const game = new Phaser.Game(config);
