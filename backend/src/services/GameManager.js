const GameRoom = require('../models/GameRoom');
const questionsData = require('../data/questions');
const { v4: uuidv4 } = require('uuid');

class GameManager {
  constructor() {
    this.games = new Map();
    this.waitingPlayers = new Map();
    console.log(`GameManager initialized with ${questionsData.length} questions`);
  }

  findMatch(socket, playerName) {
    console.log(`${playerName} (${socket.id}) looking for match...`);

    // Check if there's a waiting player
    const waitingPlayerEntries = Array.from(this.waitingPlayers.entries());
    const waitingPlayerEntry = waitingPlayerEntries.find(([id]) => id !== socket.id);

    if (waitingPlayerEntry) {
      const [waitingPlayerId, waitingPlayerName] = waitingPlayerEntry;
      const waitingPlayerSocket = socket.nsp.sockets.get(waitingPlayerId);

      if (waitingPlayerSocket) {
        // Create new game room
        const gameId = uuidv4();
        const gameRoom = new GameRoom(gameId, questionsData);

        // Add both players
        const player1Added = gameRoom.addPlayer(waitingPlayerSocket, waitingPlayerName);
        const player2Added = gameRoom.addPlayer(socket, playerName);

        if (player1Added && player2Added) {
          // Remove from waiting
          this.waitingPlayers.delete(waitingPlayerId);

          // Join socket rooms
          waitingPlayerSocket.join(gameId);
          socket.join(gameId);

          // Store game
          this.games.set(gameId, gameRoom);

          console.log(`Match created! Game ${gameId}: ${waitingPlayerName} vs ${playerName}`);

          // Notify players
          gameRoom.broadcast('matchFound', {
            gameId: gameId,
            players: gameRoom.players.map(p => ({ id: p.id, name: p.name }))
          });

          // Start game after brief delay
          setTimeout(() => {
            gameRoom.startGame();
          }, 2000);

          return true;
        } else {
          console.error('Failed to add players to game room');
          this.waitingPlayers.set(socket.id, playerName);
          socket.emit('waitingForMatch');
          return false;
        }
      } else {
        // Waiting player socket no longer exists, clean up
        console.log(`Waiting player ${waitingPlayerId} socket no longer exists, cleaning up`);
        this.waitingPlayers.delete(waitingPlayerId);
        this.waitingPlayers.set(socket.id, playerName);
        socket.emit('waitingForMatch');
        return false;
      }
    } else {
      // Add to waiting list
      console.log(`${playerName} added to waiting list (${this.waitingPlayers.size + 1} total waiting)`);
      this.waitingPlayers.set(socket.id, playerName);
      socket.emit('waitingForMatch');
      return false;
    }
  }

  handleGuess(socket, guess) {
    // Find which game this player is in
    for (const [gameId, game] of this.games) {
      const player = game.players.find(p => p.id === socket.id);
      if (player) {
        console.log(`Processing guess from ${player.name} in game ${gameId}: "${guess}"`);
        game.handleGuess(socket.id, guess);
        return;
      }
    }

    console.log(`No active game found for player ${socket.id} when submitting guess: "${guess}"`);
  }

  handleDisconnection(socket) {
    console.log('Player disconnected:', socket.id);

    // Remove from waiting list
    const wasWaiting = this.waitingPlayers.has(socket.id);
    if (wasWaiting) {
      this.waitingPlayers.delete(socket.id);
      console.log(`Removed ${socket.id} from waiting list (${this.waitingPlayers.size} remaining)`);
    }

    // Remove from any active games
    for (const [gameId, game] of this.games) {
      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const disconnectedPlayer = game.players[playerIndex];
        console.log(`${disconnectedPlayer.name} left game ${gameId} (${game.players.length} players before removal)`);

        // Remove player from game
        game.removePlayer(socket.id);

        // Handle remaining players
        if (game.players.length === 1) {
          console.log(`Only 1 player remaining in game ${gameId}, notifying and scheduling cleanup`);
          game.broadcast('playerDisconnected');

          // End the game after a delay to allow the remaining player to see the message
          setTimeout(() => {
            console.log(`Cleaning up game ${gameId} due to player disconnection`);
            this.games.delete(gameId);
            game.cleanup();
          }, 5000);
        } else if (game.players.length === 0) {
          console.log(`No players remaining in game ${gameId}, cleaning up immediately`);
          this.games.delete(gameId);
          game.cleanup();
        }
        return;
      }
    }

    if (!wasWaiting) {
      console.log(`Disconnected player ${socket.id} was not in waiting list or active games`);
    }
  }

  // Clean up finished games
  cleanupGame(gameId) {
    const game = this.games.get(gameId);
    if (game) {
      console.log(`Manually cleaning up finished game ${gameId}`);
      this.games.delete(gameId);
      game.cleanup();
    }
  }

  // Get a specific game by ID
  getGame(gameId) {
    return this.games.get(gameId);
  }

  // Get all games with a specific state
  getGamesByState(state) {
    return Array.from(this.games.values()).filter(game => game.gameState === state);
  }

  // Get statistics about the game manager
  getStats() {
    const gameStats = Array.from(this.games.values()).map(game => game.getStats());
    const gamesByState = {
      waiting: gameStats.filter(g => g.gameState === 'waiting').length,
      playing: gameStats.filter(g => g.gameState === 'playing').length,
      finished: gameStats.filter(g => g.gameState === 'finished').length
    };

    return {
      activeGames: this.games.size,
      waitingPlayers: this.waitingPlayers.size,
      totalQuestions: questionsData.length,
      gamesByState,
      gameDetails: gameStats,
      waitingPlayersList: Array.from(this.waitingPlayers.values()) // For debugging
    };
  }

  // Get detailed information for debugging
  getDetailedStats() {
    const stats = this.getStats();
    const detailedGames = Array.from(this.games.entries()).map(([id, game]) => ({
      id,
      ...game.getStats(),
      players: game.players.map(p => ({ id: p.id, name: p.name, health: p.health }))
    }));

    return {
      ...stats,
      detailedGames,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  // Cleanup all games and waiting players (for graceful shutdown)
  cleanup() {
    console.log(`GameManager cleanup: ${this.games.size} active games, ${this.waitingPlayers.size} waiting players`);

    // Cleanup all games
    for (const [gameId, game] of this.games) {
      console.log(`Cleaning up game ${gameId}`);
      game.cleanup();
    }
    this.games.clear();

    // Clear waiting players
    this.waitingPlayers.clear();

    console.log('GameManager cleanup completed');
  }

  // Health check method
  healthCheck() {
    const stats = this.getStats();
    const isHealthy = stats.totalQuestions > 0; // Basic health check

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      ...stats
    };
  }

  // Force cleanup of stale games (can be called periodically)
  cleanupStaleGames(maxAgeMinutes = 30) {
    const now = Date.now();
    const maxAge = maxAgeMinutes * 60 * 1000; // Convert to milliseconds
    let cleanedCount = 0;

    for (const [gameId, game] of this.games) {
      // If game has been running for too long or has no players
      const gameAge = now - (game.startTime || now);
      if (gameAge > maxAge || game.players.length === 0) {
        console.log(`Cleaning up stale game ${gameId} (age: ${Math.round(gameAge / 1000 / 60)} minutes, players: ${game.players.length})`);
        this.games.delete(gameId);
        game.cleanup();
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} stale games`);
    }

    return cleanedCount;
  }

  // Get player info across all games
  getAllPlayers() {
    const players = [];

    // Add waiting players
    for (const [socketId, playerName] of this.waitingPlayers) {
      players.push({
        id: socketId,
        name: playerName,
        status: 'waiting',
        gameId: null
      });
    }

    // Add players in active games
    for (const [gameId, game] of this.games) {
      for (const player of game.players) {
        players.push({
          id: player.id,
          name: player.name,
          status: `in-game-${game.gameState}`,
          gameId: gameId,
          score: player.score,
          health: player.health
        });
      }
    }

    return players;
  }
}

module.exports = GameManager;
