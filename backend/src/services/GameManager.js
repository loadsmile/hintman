const GameRoom = require('../models/GameRoom');
const { v4: uuidv4 } = require('uuid');

class GameManager {
  constructor(questionsData) {
    this.gameRooms = new Map();
    this.questionsData = questionsData;
    this.connectedPlayers = new Map();
  }

  // Handle player connection
  handleConnection(socket) {
    this.connectedPlayers.set(socket.id, {
      socket,
      connectedAt: Date.now(),
      currentRoom: null
    });

    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });

    socket.on('findMatch', (playerData) => {
      this.findMatch(socket, playerData);
    });

    socket.on('submitGuess', ({ guess }) => {
      this.handleGuess(socket, guess);
    });
  }

  // Handle disconnection
  handleDisconnection(socket) {
    console.log('Player disconnected:', socket.id);

    const playerInfo = this.connectedPlayers.get(socket.id);
    if (playerInfo && playerInfo.currentRoom) {
      const room = this.gameRooms.get(playerInfo.currentRoom);
      if (room) {
        room.removePlayer(socket.id);

        if (room.players.length > 0) {
          room.broadcast('playerDisconnected', {
            disconnectedPlayer: socket.id
          });
        }

        if (room.players.length === 0) {
          this.gameRooms.delete(playerInfo.currentRoom);
        }
      }
    }

    this.connectedPlayers.delete(socket.id);
  }

  // Find match - Updated for new structure
  findMatch(socket, playerData) {
    const {
      playerName,
      gameMode = 'general',
      personalCategory = 'general'
    } = playerData;

    console.log(`${playerName} (${socket.id}) looking for ${gameMode} match...`);

    // Look for existing room with same game mode
    let availableRoom = null;
    for (const room of this.gameRooms.values()) {
      if (room.gameState === 'waiting' &&
          room.players.length === 1 &&
          room.gameMode === gameMode) {
        availableRoom = room;
        break;
      }
    }

    if (availableRoom) {
      // Join existing room
      const success = availableRoom.addPlayer(socket, playerName, gameMode, personalCategory);
      if (success) {
        console.log(`Match found! ${playerName} joined room ${availableRoom.id}`);

        const playerInfo = this.connectedPlayers.get(socket.id);
        if (playerInfo) {
          playerInfo.currentRoom = availableRoom.id;
        }

        const players = availableRoom.players.map(p => ({
          id: p.id,
          name: p.name,
          gameMode: p.gameMode,
          personalCategory: p.personalCategory
        }));

        // Use the room's broadcast method
        availableRoom.broadcast('matchFound', {
          players,
          gameMode
        });

        // Start game after delay
        setTimeout(() => {
          if (availableRoom.players.length === 2 && availableRoom.gameState === 'waiting') {
            availableRoom.startGame();
          }
        }, 2000);

        return;
      }
    }

    // Create new room
    const roomId = uuidv4().split('-')[0].toUpperCase();
    const gameRoom = new GameRoom(roomId, this.questionsData, 'general', gameMode);

    const success = gameRoom.addPlayer(socket, playerName, gameMode, personalCategory);
    if (success) {
      this.gameRooms.set(roomId, gameRoom);

      const playerInfo = this.connectedPlayers.get(socket.id);
      if (playerInfo) {
        playerInfo.currentRoom = roomId;
      }

      console.log(`${playerName} added to waiting list (${this.getWaitingPlayersCount()} total waiting)`);

      socket.emit('waitingForMatch', {
        roomId,
        gameMode
      });

      // Timeout for solo players
      setTimeout(() => {
        if (gameRoom.players.length === 1 && gameRoom.gameState === 'waiting') {
          if (gameRoom.players[0] && gameRoom.players[0].socket.connected) {
            gameRoom.players[0].socket.emit('matchTimeout');
          }
          this.gameRooms.delete(roomId);
        }
      }, 120000);
    }
  }

  // Handle guess
  handleGuess(socket, guess) {
    const playerInfo = this.connectedPlayers.get(socket.id);
    if (!playerInfo || !playerInfo.currentRoom) {
      return;
    }

    const room = this.gameRooms.get(playerInfo.currentRoom);
    if (!room || room.gameState !== 'playing') {
      return;
    }

    room.handleGuess(socket.id, guess);
  }

  // Get waiting players count
  getWaitingPlayersCount() {
    let count = 0;
    for (const room of this.gameRooms.values()) {
      if (room.gameState === 'waiting') {
        count += room.players.length;
      }
    }
    return count;
  }

  // Get stats
  getStats() {
    const totalRooms = this.gameRooms.size;
    const totalPlayers = this.connectedPlayers.size;

    const roomStats = {
      waiting: 0,
      playing: 0,
      finished: 0
    };

    for (const room of this.gameRooms.values()) {
      roomStats[room.gameState] = (roomStats[room.gameState] || 0) + 1;
    }

    return {
      totalRooms,
      totalPlayers,
      roomStats,
      questionsAvailable: this.questionsData.length
    };
  }

  // Cleanup method
  cleanupAbandonedRooms() {
    const roomsToDelete = [];

    for (const [roomId, room] of this.gameRooms.entries()) {
      if (room.players.length === 0) {
        roomsToDelete.push(roomId);
      }
    }

    roomsToDelete.forEach(roomId => {
      this.gameRooms.delete(roomId);
    });
  }

  // Shutdown
  shutdown() {
    console.log('GameManager shutting down...');

    for (const room of this.gameRooms.values()) {
      if (room.broadcast) {
        room.broadcast('serverShutdown', { reason: 'Server maintenance' });
      }
      if (room.cleanup) {
        room.cleanup();
      }
    }

    this.gameRooms.clear();
    this.connectedPlayers.clear();
  }
}

module.exports = GameManager;
