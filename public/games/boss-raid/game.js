/**
 * game.js - Boss Raid Game Logic
 *
 * GAME MECHANICS:
 * - Boss in center with HP bar
 * - Viewers chat "join" to spawn avatar
 * - Viewers chat "hit" to attack boss
 * - Small gift: Heal boss (troll mode)
 * - Large gift: Ultimate attack (screen shake + massive damage)
 *
 * MULTI-TENANT:
 * - Parse ?id=username from URL
 * - Join Socket.io room by username
 * - Only receive events from the corresponding streamer
 *
 * @module games/boss-raid
 */

// ==========================================
// CANVAS SETUP
// ==========================================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

/**
 * Resize canvas to full screen
 */
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ==========================================
// UI ELEMENTS
// ==========================================
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const leaderboardList = document.getElementById("leaderboardList");
const joinHint = document.getElementById("joinHint");

// ==========================================
// GAME STATE
// ==========================================
const gameState = {
  boss: {
    x: 0,
    y: 0,
    radius: 80,
    maxHp: 10000,
    currentHp: 10000,
    color: "#ff4444",
    shaking: false,
    shakeIntensity: 0,
  },
  players: new Map(), // Map<uniqueId, playerObject>
  attacks: [], // Array of attack animations
  particles: [], // Array of particle effects
  damageTexts: [], // Floating damage numbers
  screenShake: { x: 0, y: 0 },
  lastUpdate: Date.now(),
};

// ==========================================
// GET USERNAME FROM URL
//
// IMPORTANT: This username is used as Room ID
// to ensure we only receive events from the correct streamer
// ==========================================
function getUsernameFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const username = urlParams.get("id");

  if (!username) {
    console.error("[Game] Username not found in URL!");
    statusText.textContent = "Error: Missing username in URL";
    statusDot.classList.add("error");
    return null;
  }

  return username.toLowerCase().trim();
}

const streamerUsername = getUsernameFromURL();
console.log(`[Game] Streamer username: ${streamerUsername}`);

// ==========================================
// SOCKET.IO CONNECTION
//
// DATA ISOLATION:
// - Connect to server
// - emit('join-room', username) to join private room
// - Only receive events from this streamer's room
// ==========================================
const socket = io();

if (streamerUsername) {
  socket.emit("join-room", streamerUsername);
  console.log(`[Socket] Joining room: ${streamerUsername}`);
}

// ==========================================
// SOCKET EVENT HANDLERS
// ==========================================

/**
 * Successfully joined room
 */
socket.on("room-joined", (data) => {
  console.log("[Socket] Joined room:", data);
  statusText.textContent = `Connected: @${streamerUsername}`;
  statusDot.classList.add("connected");
});

/**
 * Connected to TikTok Live
 */
socket.on("tiktok_connected", (data) => {
  console.log("[Socket] TikTok connected:", data);
  statusText.textContent = `LIVE: @${streamerUsername}`;
});

/**
 * Connection error
 */
socket.on("connection-error", (data) => {
  console.error("[Socket] Connection error:", data);
  statusText.textContent = data.message;
  statusDot.classList.add("error");
});

/**
 * PLAYER JOIN
 *
 * When viewer chats "join" -> Server sends this event
 * Spawn new avatar around the boss
 */
socket.on("player_join", (data) => {
  console.log("[Game] Player join:", data.user.nickname);

  const { user } = data;

  // Check if player already exists
  if (gameState.players.has(user.uniqueId)) {
    console.log("[Game] Player already exists:", user.nickname);
    return;
  }

  // Create random position around boss
  const angle = Math.random() * Math.PI * 2;
  const distance = gameState.boss.radius + 80 + Math.random() * 150;

  const player = {
    uniqueId: user.uniqueId,
    nickname: user.nickname,
    avatar: user.profilePictureUrl,
    x: canvas.width / 2 + Math.cos(angle) * distance,
    y: canvas.height / 2 + Math.sin(angle) * distance,
    targetX: 0,
    targetY: 0,
    radius: 25,
    color: getRandomColor(),
    damage: 0, // Total damage dealt
    attacking: false,
    hp: 100,
    maxHp: 100,
  };

  gameState.players.set(user.uniqueId, player);

  // Hide join hint after first player joins
  joinHint.style.display = "none";

  // Particle effect on join
  spawnParticles(player.x, player.y, "#00ff88", 10);

  updateLeaderboard();
});

/**
 * PLAYER ATTACK
 *
 * When viewer chats "hit" -> Server sends this event
 * Attack animation from player to boss
 */
socket.on("player_attack", (data) => {
  console.log(
    "[Game] Player attack:",
    data.user.nickname,
    "Damage:",
    data.damage
  );

  const { user, damage } = data;

  // Find player
  let player = gameState.players.get(user.uniqueId);

  // If not joined, auto-join
  if (!player) {
    const angle = Math.random() * Math.PI * 2;
    const distance = gameState.boss.radius + 80 + Math.random() * 150;

    player = {
      uniqueId: user.uniqueId,
      nickname: user.nickname,
      avatar: user.profilePictureUrl,
      x: canvas.width / 2 + Math.cos(angle) * distance,
      y: canvas.height / 2 + Math.sin(angle) * distance,
      radius: 25,
      color: getRandomColor(),
      damage: 0,
      attacking: false,
      hp: 100,
      maxHp: 100,
    };

    gameState.players.set(user.uniqueId, player);
  }

  // Create attack animation
  createAttack(player, damage);

  // Update damage
  player.damage += damage;

  // Deal damage to boss
  gameState.boss.currentHp = Math.max(0, gameState.boss.currentHp - damage);

  // Floating damage text
  spawnDamageText(gameState.boss.x, gameState.boss.y, damage, "#ff4444");

  // Particles
  spawnParticles(gameState.boss.x, gameState.boss.y, "#ff4444", 5);

  updateLeaderboard();

  // Check boss defeated
  if (gameState.boss.currentHp <= 0) {
    bossDefeated();
  }
});

/**
 * GIFT RECEIVED
 *
 * Categorize gifts to trigger different effects:
 * - small: Heal boss (troll mode)
 * - medium: Normal attack
 * - large: ULTIMATE! Screen shake + massive damage
 */
socket.on("gift_received", (data) => {
  console.log("[Game] Gift received:", data);

  const { user, giftName, giftValue, giftType, repeatCount } = data;

  // Show notification
  showGiftNotification(user.nickname, giftName, repeatCount);

  switch (giftType) {
    case "small":
      // TROLL: Heal boss slightly
      const healAmount = giftValue * repeatCount * 5;
      gameState.boss.currentHp = Math.min(
        gameState.boss.maxHp,
        gameState.boss.currentHp + healAmount
      );
      spawnDamageText(
        gameState.boss.x,
        gameState.boss.y,
        `+${healAmount}`,
        "#00ff88"
      );
      spawnParticles(gameState.boss.x, gameState.boss.y, "#00ff88", 10);
      break;

    case "medium":
      // Medium attack
      const mediumDamage = giftValue * repeatCount * 10;
      gameState.boss.currentHp = Math.max(
        0,
        gameState.boss.currentHp - mediumDamage
      );
      spawnDamageText(
        gameState.boss.x,
        gameState.boss.y,
        mediumDamage,
        "#ffd700"
      );
      spawnParticles(gameState.boss.x, gameState.boss.y, "#ffd700", 15);

      // Update player damage if exists
      const medPlayer = gameState.players.get(user.uniqueId);
      if (medPlayer) {
        medPlayer.damage += mediumDamage;
        updateLeaderboard();
      }
      break;

    case "large":
      // ULTIMATE ATTACK!
      triggerUltimate(user, giftValue * repeatCount);
      break;
  }

  // Check boss defeated
  if (gameState.boss.currentHp <= 0) {
    bossDefeated();
  }
});

// ==========================================
// GAME FUNCTIONS
// ==========================================

/**
 * Create attack animation
 * @param {Object} player - Player object
 * @param {number} damage - Damage amount
 */
function createAttack(player, damage) {
  const attack = {
    startX: player.x,
    startY: player.y,
    currentX: player.x,
    currentY: player.y,
    targetX: gameState.boss.x,
    targetY: gameState.boss.y,
    progress: 0,
    speed: 0.05,
    damage: damage,
    color: player.color,
  };

  gameState.attacks.push(attack);
}

/**
 * ULTIMATE ATTACK
 * Screen shake + massive damage + epic particles
 * @param {Object} user - User who triggered ultimate
 * @param {number} value - Gift value
 */
function triggerUltimate(user, value) {
  const ultimateDamage = value * 50;

  // Screen shake
  gameState.boss.shaking = true;
  gameState.boss.shakeIntensity = 20;

  setTimeout(() => {
    gameState.boss.shaking = false;
    gameState.boss.shakeIntensity = 0;
  }, 1000);

  // Massive damage
  gameState.boss.currentHp = Math.max(
    0,
    gameState.boss.currentHp - ultimateDamage
  );

  // Epic damage text
  spawnDamageText(
    gameState.boss.x,
    gameState.boss.y,
    `💥 ${ultimateDamage}`,
    "#ff00ff"
  );

  // Lots of particles
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      spawnParticles(gameState.boss.x, gameState.boss.y, "#ff00ff", 20);
    }, i * 100);
  }

  // Update player damage
  const ultPlayer = gameState.players.get(user.uniqueId);
  if (ultPlayer) {
    ultPlayer.damage += ultimateDamage;
    updateLeaderboard();
  }

  console.log(
    `[Game] ULTIMATE! ${user.nickname} dealt ${ultimateDamage} damage!`
  );
}

/**
 * Boss defeated - respawn with higher HP
 */
function bossDefeated() {
  console.log("[Game] BOSS DEFEATED!");

  // Epic explosion
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      spawnParticles(
        gameState.boss.x + (Math.random() - 0.5) * 100,
        gameState.boss.y + (Math.random() - 0.5) * 100,
        getRandomColor(),
        30
      );
    }, i * 100);
  }

  // Respawn boss after 3 seconds with higher HP
  setTimeout(() => {
    gameState.boss.maxHp = Math.floor(gameState.boss.maxHp * 1.5);
    gameState.boss.currentHp = gameState.boss.maxHp;
    console.log(`[Game] Boss respawned with ${gameState.boss.maxHp} HP`);
  }, 3000);
}

/**
 * Spawn particles at position
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} color - Particle color
 * @param {number} count - Number of particles
 */
function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 5;

    gameState.particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 3 + Math.random() * 5,
      color: color,
      alpha: 1,
      decay: 0.02 + Math.random() * 0.02,
    });
  }
}

/**
 * Spawn floating damage text
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string|number} text - Damage text
 * @param {string} color - Text color
 */
function spawnDamageText(x, y, text, color) {
  gameState.damageTexts.push({
    x: x + (Math.random() - 0.5) * 50,
    y: y,
    text: String(text),
    color: color,
    alpha: 1,
    vy: -2,
  });
}

/**
 * Show gift notification
 * @param {string} nickname - User nickname
 * @param {string} giftName - Gift name
 * @param {number} count - Gift count
 */
function showGiftNotification(nickname, giftName, count) {
  const notification = document.createElement("div");
  notification.className = "gift-notification";
  notification.innerHTML = `🎁 ${nickname}<br>${giftName} x${count}`;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 2000);
}

/**
 * Update leaderboard UI
 */
function updateLeaderboard() {
  // Sort by damage (descending)
  const sorted = Array.from(gameState.players.values())
    .sort((a, b) => b.damage - a.damage)
    .slice(0, 3); // Top 3

  if (sorted.length === 0) {
    leaderboardList.innerHTML =
      '<p style="color: rgba(255,255,255,0.5); text-align: center; font-size: 14px;">No players yet</p>';
    return;
  }

  const rankClasses = ["gold", "silver", "bronze"];

  leaderboardList.innerHTML = sorted
    .map(
      (player, index) => `
        <div class="leaderboard-item">
            <div class="leaderboard-rank ${rankClasses[index]}">${
        index + 1
      }</div>
            <img src="${player.avatar || "https://via.placeholder.com/40"}"
                 alt="${player.nickname}"
                 class="leaderboard-avatar"
                 onerror="this.src='https://via.placeholder.com/40'">
            <div class="leaderboard-info">
                <div class="leaderboard-name">${player.nickname}</div>
                <div class="leaderboard-damage">💥 ${formatNumber(
                  player.damage
                )} damage</div>
            </div>
        </div>
    `
    )
    .join("");
}

/**
 * Format large numbers
 * @param {number} num - Number to format
 * @returns {string} Formatted string
 */
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

/**
 * Get random color from palette
 * @returns {string} Random hex color
 */
function getRandomColor() {
  const colors = [
    "#fe2c55",
    "#25f4ee",
    "#8b5cf6",
    "#3b82f6",
    "#ffd700",
    "#00ff88",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// ==========================================
// RENDER FUNCTIONS
// ==========================================

/**
 * Draw boss
 */
function drawBoss() {
  const boss = gameState.boss;

  // Update boss position (center of screen)
  boss.x = canvas.width / 2;
  boss.y = canvas.height / 2;

  // Screen shake offset
  let offsetX = 0,
    offsetY = 0;
  if (boss.shaking) {
    offsetX = (Math.random() - 0.5) * boss.shakeIntensity;
    offsetY = (Math.random() - 0.5) * boss.shakeIntensity;
  }

  const x = boss.x + offsetX;
  const y = boss.y + offsetY;

  // Glow effect
  ctx.shadowColor = boss.color;
  ctx.shadowBlur = 30;

  // Boss body
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, boss.radius);
  gradient.addColorStop(0, "#ff6666");
  gradient.addColorStop(0.7, boss.color);
  gradient.addColorStop(1, "#661111");

  ctx.beginPath();
  ctx.arc(x, y, boss.radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Boss face
  ctx.shadowBlur = 0;

  // Eyes
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x - 25, y - 15, 15, 0, Math.PI * 2);
  ctx.arc(x + 25, y - 15, 15, 0, Math.PI * 2);
  ctx.fill();

  // Pupils
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(x - 25, y - 15, 8, 0, Math.PI * 2);
  ctx.arc(x + 25, y - 15, 8, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y + 20, 25, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();

  // HP Bar
  const hpBarWidth = 200;
  const hpBarHeight = 20;
  const hpBarX = x - hpBarWidth / 2;
  const hpBarY = y - boss.radius - 40;
  const hpPercent = boss.currentHp / boss.maxHp;

  // HP Bar background
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.beginPath();
  ctx.roundRect(hpBarX - 5, hpBarY - 5, hpBarWidth + 10, hpBarHeight + 10, 10);
  ctx.fill();

  // HP Bar fill
  const hpGradient = ctx.createLinearGradient(
    hpBarX,
    hpBarY,
    hpBarX + hpBarWidth,
    hpBarY
  );
  hpGradient.addColorStop(0, "#ff0000");
  hpGradient.addColorStop(0.5, "#ff4444");
  hpGradient.addColorStop(1, "#ff0000");

  ctx.fillStyle = hpGradient;
  ctx.beginPath();
  ctx.roundRect(hpBarX, hpBarY, hpBarWidth * hpPercent, hpBarHeight, 5);
  ctx.fill();

  // HP Text
  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.fillText(
    `${formatNumber(boss.currentHp)} / ${formatNumber(boss.maxHp)}`,
    x,
    hpBarY + 15
  );

  // Boss name
  ctx.font = "bold 24px Arial";
  ctx.fillStyle = "#fff";
  ctx.fillText("👹 BOSS", x, hpBarY - 15);
}

/**
 * Draw all players
 */
function drawPlayers() {
  gameState.players.forEach((player) => {
    const { x, y, radius, color, nickname } = player;

    // Player circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Player nickname
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(nickname.substring(0, 10), x, y + radius + 18);
  });
}

/**
 * Update and draw attacks
 */
function updateAttacks() {
  gameState.attacks = gameState.attacks.filter((attack) => {
    // Update position
    attack.progress += attack.speed;

    if (attack.progress >= 1) {
      // Attack reached boss
      spawnParticles(attack.targetX, attack.targetY, attack.color, 5);
      return false;
    }

    // Lerp position
    attack.currentX =
      attack.startX + (attack.targetX - attack.startX) * attack.progress;
    attack.currentY =
      attack.startY + (attack.targetY - attack.startY) * attack.progress;

    // Draw attack projectile
    ctx.beginPath();
    ctx.arc(attack.currentX, attack.currentY, 8, 0, Math.PI * 2);
    ctx.fillStyle = attack.color;
    ctx.fill();

    // Trail effect
    ctx.beginPath();
    ctx.moveTo(attack.startX, attack.startY);
    ctx.lineTo(attack.currentX, attack.currentY);
    ctx.strokeStyle = attack.color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.3;
    ctx.stroke();
    ctx.globalAlpha = 1;

    return true;
  });
}

/**
 * Update and draw particles
 */
function updateParticles() {
  gameState.particles = gameState.particles.filter((p) => {
    // Update
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= p.decay;
    p.radius *= 0.98;

    if (p.alpha <= 0) return false;

    // Draw
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.globalAlpha = 1;

    return true;
  });
}

/**
 * Update and draw damage texts
 */
function updateDamageTexts() {
  gameState.damageTexts = gameState.damageTexts.filter((dt) => {
    // Update
    dt.y += dt.vy;
    dt.alpha -= 0.015;

    if (dt.alpha <= 0) return false;

    // Draw
    ctx.globalAlpha = dt.alpha;
    ctx.font = "bold 28px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = dt.color;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.strokeText(dt.text, dt.x, dt.y);
    ctx.fillText(dt.text, dt.x, dt.y);
    ctx.globalAlpha = 1;

    return true;
  });
}

// ==========================================
// GAME LOOP
// ==========================================
function gameLoop() {
  // Clear canvas (transparent background)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw game elements
  drawBoss();
  drawPlayers();
  updateAttacks();
  updateParticles();
  updateDamageTexts();

  // Continue loop
  requestAnimationFrame(gameLoop);
}

// ==========================================
// START GAME
// ==========================================
console.log("[Game] Boss Raid game initialized");
gameLoop();
