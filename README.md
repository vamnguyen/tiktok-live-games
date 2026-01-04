# TikTok Live Games 🎮

An open-source platform that creates interactive game overlays for TikTok Live streams. Viewers can play games by typing commands in chat!

![Dashboard](https://via.placeholder.com/800x400?text=Dashboard+Preview)

## ✨ Features

- **Multi-tenant Architecture**: Multiple streamers can use the platform simultaneously with complete data isolation
- **Real-time Interaction**: Viewers control the game through TikTok Live chat
- **OBS/TikTok Studio Ready**: Transparent overlay designed for streaming software
- **Gift Integration**: TikTok gifts trigger special in-game effects
- **Extensible**: Easy to add new games

## 🎯 Available Games

### Boss Raid 👹

Viewers team up to defeat a boss!

| Command    | Action                      |
| ---------- | --------------------------- |
| `join`     | Join the battle             |
| `hit`      | Attack the boss             |
| Small Gift | Heal the boss (troll mode!) |
| Large Gift | Trigger ULTIMATE attack     |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/tiktok-live-games.git
cd tiktok-live-games

# Install dependencies
npm install

# Start the server
npm start
```

### Usage

1. Open the dashboard: http://localhost:3000
2. Enter your TikTok username
3. Select a game (Boss Raid)
4. Click "Generate Game Link"
5. Copy the overlay URL
6. Add as Browser Source in OBS/TikTok Studio
7. Start streaming and tell viewers to type `join`!

> **Note**: The TikTok username must be currently LIVE for the connection to work.

## 📁 Project Structure

```
tiktok-live-games/
├── package.json           # Project dependencies
├── src/
│   ├── server.js          # Express + Socket.io server
│   └── services/
│       └── TikTokService.js  # TikTok connection manager
└── public/
    ├── index.html         # Dashboard UI
    ├── css/
    │   └── styles.css     # Global styles
    ├── js/
    │   └── dashboard.js   # Dashboard logic
    └── games/
        └── boss-raid/     # Boss Raid game
            ├── overlay.html
            └── game.js
```

## 🏗️ Architecture

### Multi-tenant Isolation

- Each streamer gets their own **Socket.io Room** (Room ID = username)
- TikTok events are routed only to the relevant room
- No data leakage between streamers

### Connection Management

- **Singleton Pattern**: Single `TikTokService` instance manages all connections
- **Connection Reuse**: Existing connections are reused, not recreated
- **Auto-disconnect**: Connections close after 5 minutes of inactivity

```
┌─────────────────────────────────────────────────────────┐
│                    TikTok Live                          │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│   TikTokService (Singleton)                             │
│   ┌─────────────────────────────────────────────────┐   │
│   │ connections: Map<username, WebcastConnection>   │   │
│   └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ Room: A  │    │ Room: B  │    │ Room: C  │
    │ (user_a) │    │ (user_b) │    │ (user_c) │
    └──────────┘    └──────────┘    └──────────┘
          │                │                │
          ▼                ▼                ▼
    [Game Overlay]   [Game Overlay]   [Game Overlay]
```

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup

```bash
# Fork and clone the repo
git clone https://github.com/YOUR_USERNAME/tiktok-live-games.git
cd tiktok-live-games

# Install dependencies
npm install

# Start in development mode (auto-reload)
npm run dev
```

### Adding a New Game

1. Create a new folder in `public/games/your-game-name/`
2. Add `overlay.html` and `game.js`
3. Update the dashboard to include your game in the selection
4. Submit a PR!

**Game Template Structure:**

```
public/games/your-game/
├── overlay.html    # Game UI (transparent background for OBS)
└── game.js         # Game logic + Socket.io handlers
```

**Required Socket Events:**

```javascript
// Your game.js should handle these events:
socket.on("player_join", (data) => {
  /* Handle player joining */
});
socket.on("player_attack", (data) => {
  /* Handle attacks */
});
socket.on("gift_received", (data) => {
  /* Handle gifts */
});
```

### Contribution Guidelines

1. **Fork** the repository
2. Create a **feature branch**: `git checkout -b feature/amazing-game`
3. **Commit** your changes: `git commit -m 'Add amazing game'`
4. **Push** to branch: `git push origin feature/amazing-game`
5. Open a **Pull Request**

### Code Style

- Use **ES Modules** (`import`/`export`)
- Write **comments in English**
- Use **JSDoc** for function documentation
- Follow existing code formatting

## 📄 API Reference

### REST Endpoints

| Endpoint      | Method | Description           |
| ------------- | ------ | --------------------- |
| `/api/health` | GET    | Server health check   |
| `/api/stats`  | GET    | Connection statistics |

### Socket.io Events

**Client → Server:**
| Event | Payload | Description |
|-------|---------|-------------|
| `join-room` | `username: string` | Join a streamer's room |
| `leave-room` | `username: string` | Leave a room |

**Server → Client:**
| Event | Payload | Description |
|-------|---------|-------------|
| `room-joined` | `{room, message}` | Successfully joined room |
| `player_join` | `{user, timestamp}` | A viewer joined the game |
| `player_attack` | `{user, damage, timestamp}` | A viewer attacked |
| `gift_received` | `{user, giftName, giftValue, giftType, repeatCount}` | Gift received |
| `tiktok_connected` | `{roomId}` | Connected to TikTok Live |
| `connection-error` | `{message}` | Connection failed |

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [tiktok-live-connector](https://github.com/zerodytrash/TikTok-Live-Connector) - TikTok Live wrapper
- [Socket.io](https://socket.io/) - Real-time communication
- Vietnamese Streamer Community 💖

---

**Made with ❤️ for Vietnamese Streamers**
