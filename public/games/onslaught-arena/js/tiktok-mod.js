/**
 * tiktok-mod.js
 * Bridges TikTokBridge events to Onslaught! Arena engine.
 */
(function () {
  const KEY_PULSE_MS = 500; // How long a key stays "pressed" from one comment

  // Key mapping based on horde.Keyboard.Keys
  const Keys = {
    UP: 38,
    DOWN: 40,
    LEFT: 37,
    RIGHT: 39,
    W: 87,
    S: 83,
    A: 65,
    D: 68,
    FIRE: 32, // Space
    Z: 90, // Alternative fire
    X: 88, // Special/Switch
  };

  const activeKeys = {};

  function pressKey(keyCode, duration = KEY_PULSE_MS) {
    if (!window.gameEngine || !window.gameEngine.keyboard) return;

    const kb = window.gameEngine.keyboard;
    kb.keyStates[keyCode] = true;

    // Clear existing timeout if any
    if (activeKeys[keyCode]) {
      clearTimeout(activeKeys[keyCode]);
    }

    activeKeys[keyCode] = setTimeout(() => {
      kb.keyStates[keyCode] = false;
      delete activeKeys[keyCode];
    }, duration);
  }

  // Initialize TikTok Bridge
  const urlParams = new URLSearchParams(window.location.search);
  const username = urlParams.get("username");

  console.log(`[TikTokMod] Connecting for user: ${username}`);
  TikTokBridge.connect(username);

  TikTokBridge.on("chat", (data) => {
    const comment = data.comment.toLowerCase().trim();

    // Movement commands (Mapped to WSAD per game engine default)
    if (comment.includes("lên") || comment === "up" || comment === "w")
      pressKey(Keys.W);
    if (comment.includes("xuống") || comment === "down" || comment === "s")
      pressKey(Keys.S);
    if (comment.includes("trái") || comment === "left" || comment === "a")
      pressKey(Keys.A);
    if (comment.includes("phải") || comment === "right" || comment === "d")
      pressKey(Keys.D);

    // Firing commands (Mapped to Space or directional arrows)
    if (
      comment === "hit" ||
      comment === "đánh" ||
      comment === "fire" ||
      comment === "bắn"
    ) {
      pressKey(Keys.FIRE, 200);
    }

    // Directional firing (Uses Arrow keys)
    if (comment === "shoot up" || comment === "bắn lên") pressKey(Keys.UP, 200);
    if (comment === "shoot down" || comment === "bắn xuống")
      pressKey(Keys.DOWN, 200);
    if (comment === "shoot left" || comment === "bắn trái")
      pressKey(Keys.LEFT, 200);
    if (comment === "shoot right" || comment === "bắn phải")
      pressKey(Keys.RIGHT, 200);
  });

  TikTokBridge.on("gift", (data) => {
    console.log(`[TikTokMod] Gift received: ${data.giftName}`);
    // Gifts trigger rapid fire or special moves
    if (data.giftType === "small") {
      // Rapid fire
      let count = 0;
      const interval = setInterval(() => {
        pressKey(Keys.FIRE, 100);
        count++;
        if (count > 5) clearInterval(interval);
      }, 150);
    } else {
      // Big gift = Ultimate (X key)
      pressKey(Keys.X, 1000);
    }
  });

  TikTokBridge.on("connected", () => {
    console.log("[TikTokMod] Bridge Ready");
  });
})();
