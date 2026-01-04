/**
 * dashboard.js
 * Dashboard logic - Generate game overlay links
 *
 * Features:
 * - Game selection from grid
 * - Username validation
 * - Overlay URL generation
 * - Copy to clipboard
 *
 * @module dashboard
 */

document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // DOM ELEMENTS
  // ==========================================
  const usernameInput = document.getElementById("username");
  const generateBtn = document.getElementById("generateBtn");
  const outputSection = document.getElementById("outputSection");
  const outputUrl = document.getElementById("outputUrl");
  const copyBtn = document.getElementById("copyBtn");
  const toast = document.getElementById("toast");
  const gameCards = document.querySelectorAll(".game-card[data-game]");

  // ==========================================
  // STATE
  // ==========================================
  let selectedGame = "boss-raid"; // Default game

  // ==========================================
  // GAME SELECTION
  // Handle game card clicks
  // ==========================================
  gameCards.forEach((card) => {
    card.addEventListener("click", () => {
      // Deselect all cards
      gameCards.forEach((c) => c.classList.remove("selected"));
      // Select clicked card
      card.classList.add("selected");
      // Update state
      selectedGame = card.dataset.game;
      console.log(`Selected game: ${selectedGame}`);
    });
  });

  // ==========================================
  // GENERATE LINK
  // Create overlay URL based on username and selected game
  // ==========================================
  generateBtn.addEventListener("click", () => {
    // Get and validate username
    const username = usernameInput.value.trim().toLowerCase();

    if (!username) {
      showToast("⚠️ Please enter your TikTok username!", "error");
      usernameInput.focus();
      return;
    }

    // Remove @ if present
    const cleanUsername = username.replace("@", "");

    // Validate: only allow letters, numbers, underscore
    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      showToast(
        "⚠️ Username can only contain letters, numbers, and _",
        "error"
      );
      return;
    }

    /**
     * GENERATE OVERLAY URL
     *
     * Format: /games/{game}/overlay.html?id={username}
     *
     * IMPORTANT:
     * - Uses window.location.origin to support production deployment
     * - Username will be used as Room ID for Socket.io
     */
    const baseUrl = window.location.origin;
    const overlayUrl = `${baseUrl}/games/${selectedGame}/overlay.html?id=${cleanUsername}`;

    // Show output section
    outputUrl.value = overlayUrl;
    outputSection.classList.add("visible");

    // Scroll to output
    outputSection.scrollIntoView({ behavior: "smooth", block: "center" });

    // Button feedback
    generateBtn.textContent = "✅ Link Generated!";
    setTimeout(() => {
      generateBtn.textContent = "✨ Generate Game Link";
    }, 2000);

    console.log(`Generated overlay URL: ${overlayUrl}`);
  });

  // ==========================================
  // COPY TO CLIPBOARD
  // ==========================================
  copyBtn.addEventListener("click", async () => {
    const url = outputUrl.value;

    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      showToast("✅ Link copied!", "success");

      // Button feedback
      copyBtn.textContent = "✅ Copied!";
      setTimeout(() => {
        copyBtn.textContent = "📋 Copy";
      }, 2000);
    } catch (err) {
      // Fallback for older browsers
      outputUrl.select();
      document.execCommand("copy");
      showToast("✅ Link copied!", "success");
    }
  });

  // ==========================================
  // ENTER KEY SUPPORT
  // Press Enter in input to generate
  // ==========================================
  usernameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      generateBtn.click();
    }
  });

  // ==========================================
  // TOAST NOTIFICATION
  // ==========================================
  function showToast(message, type = "success") {
    toast.textContent = message;

    // Style based on type
    if (type === "error") {
      toast.style.borderColor = "#fe2c55";
      toast.style.color = "#fe2c55";
    } else {
      toast.style.borderColor = "#25f4ee";
      toast.style.color = "#25f4ee";
    }

    // Show toast
    toast.classList.add("show");

    // Auto hide after 3s
    setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }

  // ==========================================
  // INITIALIZATION LOG
  // ==========================================
  console.log("🎮 TikTok Live Games Dashboard loaded");
  console.log(
    "Available games:",
    Array.from(gameCards).map((c) => c.dataset.game)
  );
});
