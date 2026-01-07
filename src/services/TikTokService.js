/**
 * TikTokService.js
 * Manages TikTok Live connections for multiple streamers (Multi-tenant)
 *
 * IMPORTANT - DATA ISOLATION:
 * - Each streamer has their own Socket.io Room (Room ID = username)
 * - Data from Streamer A will NEVER be sent to Streamer B
 * - Uses io.to(username).emit() to send to the CORRECT room only
 *
 * @module services/TikTokService
 */

import { WebcastPushConnection } from "tiktok-live-connector";

class TikTokService {
  constructor() {
    // Singleton pattern - ensure only one instance exists
    if (TikTokService.instance) {
      return TikTokService.instance;
    }
    TikTokService.instance = this;

    /**
     * Map storing active TikTok connections
     * @type {Map<string, {connection: WebcastPushConnection, lastActivity: number}>}
     */
    this.connections = new Map();

    /**
     * Map tracking client count per room
     * @type {Map<string, number>}
     */
    this.roomClients = new Map();

    // Cleanup interval - check for inactive connections every minute
    this.cleanupInterval = setInterval(
      () => this.checkInactiveConnections(),
      60000
    );
  }

  /**
   * Connect to a streamer's TikTok Live
   * IMPORTANT: If connection exists, reuse it. Do NOT create new one.
   *
   * @param {string} username - TikTok username (also used as Room ID)
   * @param {import('socket.io').Server} io - Socket.io server instance
   * @returns {Promise<boolean>} - Whether connection was successful
   */
  async connect(username, io) {
    // Check if connection already exists
    if (this.connections.has(username)) {
      console.log(
        `[TikTokService] Reusing existing connection for: ${username}`
      );
      const existing = this.connections.get(username);
      existing.lastActivity = Date.now();
      return true;
    }

    console.log(`[TikTokService] Creating new connection for: ${username}`);

    try {
      // Create new TikTok Live connection
      const connection = new WebcastPushConnection(username, {
        processInitialData: true,
        enableExtendedGiftInfo: true,
        enableWebsocketUpgrade: true,
        requestPollingIntervalMs: 2000,
        sessionId: null,
      });

      // Store in Map
      this.connections.set(username, {
        connection: connection,
        lastActivity: Date.now(),
      });

      // ==========================================
      // TIKTOK EVENT HANDLERS
      // These handlers emit generic events that the
      // TikTok Bridge SDK (client-side) can consume.
      // ==========================================

      /**
       * Handle Chat Messages
       */
      connection.on("chat", (data) => {
        const message = data.comment?.toLowerCase().trim() || "";
        const user = {
          uniqueId: data.uniqueId,
          nickname: data.nickname,
          profilePictureUrl: data.profilePictureUrl,
        };

        this.updateActivity(username);

        // 1. Emit generic event for tiktok-bridge.js
        io.to(username).emit("tiktok_chat", {
          user,
          comment: message,
          rawData: data,
          timestamp: Date.now(),
        });

        // 2. Legacy/Specific command mappings (for backward compatibility)
        if (message === "join" || message === "thamgia") {
          io.to(username).emit("player_join", { user, timestamp: Date.now() });
          console.log(`[${username}] Player join: ${user.nickname}`);
        }

        if (message === "hit" || message === "danh" || message === "attack") {
          io.to(username).emit("player_attack", {
            user,
            damage: Math.floor(Math.random() * 10) + 5,
            timestamp: Date.now(),
          });
          console.log(`[${username}] Player attack: ${user.nickname}`);
        }
      });

      /**
       * Handle Like Events
       */
      connection.on("like", (data) => {
        const user = {
          uniqueId: data.uniqueId,
          nickname: data.nickname,
          profilePictureUrl: data.profilePictureUrl,
        };

        this.updateActivity(username);

        io.to(username).emit("tiktok_like", {
          user,
          likeCount: data.likeCount,
          totalLikeCount: data.totalLikeCount,
          timestamp: Date.now(),
        });

        console.log(
          `[${username}] Like: ${data.likeCount} from ${user.nickname}`
        );
      });

      /**
       * Handle Share Events
       */
      connection.on("social", (data) => {
        if (data.displayType === "pm_mt_msg_viewer_share") {
          const user = {
            uniqueId: data.uniqueId,
            nickname: data.nickname,
            profilePictureUrl: data.profilePictureUrl,
          };

          this.updateActivity(username);

          io.to(username).emit("tiktok_share", {
            user,
            timestamp: Date.now(),
          });

          console.log(`[${username}] Share from ${user.nickname}`);
        }
      });

      /**
       * Handle Gift Events
       */
      connection.on("gift", (data) => {
        const user = {
          uniqueId: data.uniqueId,
          nickname: data.nickname,
          profilePictureUrl: data.profilePictureUrl,
        };

        this.updateActivity(username);

        // Normalize gift data
        const giftValue = data.diamondCount || data.giftValue || 1;
        const giftName =
          data.giftName || data.giftDetails?.giftName || "Unknown Gift";
        const repeatCount = data.repeatCount || 1;

        // Categorize gifts for easier game logic
        let giftType = "small"; // < 10 coins
        if (giftValue >= 100) giftType = "large"; // 100+ coins
        else if (giftValue >= 10) giftType = "medium"; // 10-99 coins

        // Emit generic gift event
        io.to(username).emit("tiktok_gift", {
          user,
          giftName,
          giftValue,
          repeatCount,
          giftType,
          rawData: data,
          timestamp: Date.now(),
        });

        // Legacy event for Boss Raid compatibility
        io.to(username).emit("gift_received", {
          user,
          giftName,
          giftValue,
          repeatCount,
          giftType,
          timestamp: Date.now(),
        });

        console.log(
          `[${username}] Gift: ${giftName} x${repeatCount} (${giftType})`
        );
      });

      // ==========================================
      // CONNECTION STATUS HANDLERS
      // ==========================================
      connection.on("connected", (state) => {
        console.log(`[TikTokService] Connected to live: ${username}`);
        io.to(username).emit("tiktok_connected", {
          roomId: state.roomId,
          timestamp: Date.now(),
        });
      });

      connection.on("disconnected", () => {
        console.log(`[TikTokService] Disconnected from: ${username}`);
        io.to(username).emit("tiktok_disconnected", {
          timestamp: Date.now(),
        });
        this.connections.delete(username);
      });

      connection.on("error", (err) => {
        console.error(`[TikTokService] Error for ${username}:`, err.message);
        io.to(username).emit("tiktok_error", {
          message: err.message,
          timestamp: Date.now(),
        });
      });

      // Establish connection
      await connection.connect();
      return true;
    } catch (error) {
      console.error(
        `[TikTokService] Cannot connect to ${username}:`,
        error.message
      );
      this.connections.delete(username);
      return false;
    }
  }

  /**
   * Disconnect a streamer's TikTok connection
   * @param {string} username - TikTok username
   */
  disconnect(username) {
    if (this.connections.has(username)) {
      const { connection } = this.connections.get(username);
      try {
        connection.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      this.connections.delete(username);
      console.log(`[TikTokService] Disconnected: ${username}`);
    }
  }

  /**
   * Update last activity timestamp for a connection
   * @param {string} username - TikTok username
   */
  updateActivity(username) {
    if (this.connections.has(username)) {
      this.connections.get(username).lastActivity = Date.now();
    }
  }

  /**
   * Add a client to a room's count
   * @param {string} username - Room ID (username)
   */
  addClientToRoom(username) {
    const count = this.roomClients.get(username) || 0;
    this.roomClients.set(username, count + 1);
    console.log(`[TikTokService] Room ${username}: ${count + 1} clients`);
  }

  /**
   * Remove a client from a room's count
   * @param {string} username - Room ID (username)
   */
  removeClientFromRoom(username) {
    const count = this.roomClients.get(username) || 0;
    if (count > 0) {
      this.roomClients.set(username, count - 1);
      console.log(`[TikTokService] Room ${username}: ${count - 1} clients`);
    }
  }

  /**
   * Get client count for a room
   * @param {string} username - Room ID
   * @returns {number} Number of clients
   */
  getClientCount(username) {
    return this.roomClients.get(username) || 0;
  }

  /**
   * Check and disconnect inactive connections
   * AUTO-DISCONNECT after 5 minutes with no clients in room
   * This helps free up server resources
   */
  checkInactiveConnections() {
    const TIMEOUT = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    for (const [username, data] of this.connections.entries()) {
      const clientCount = this.getClientCount(username);
      const timeSinceActivity = now - data.lastActivity;

      if (clientCount === 0 && timeSinceActivity > TIMEOUT) {
        console.log(
          `[TikTokService] Auto-disconnect ${username} (inactive ${Math.round(
            timeSinceActivity / 1000
          )}s, 0 clients)`
        );
        this.disconnect(username);
      }
    }
  }

  /**
   * Get current service statistics
   * @returns {{activeConnections: number, connections: string[], rooms: Object}}
   */
  getStats() {
    return {
      activeConnections: this.connections.size,
      connections: Array.from(this.connections.keys()),
      rooms: Object.fromEntries(this.roomClients),
    };
  }
}

// Export singleton instance
export default new TikTokService();
