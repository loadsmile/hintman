const GameRoom = require('../models/GameRoom');
const { v4: uuidv4 } = require('uuid');

class GameManager {
  constructor(questionsData) {
    this.gameRooms = new Map();
    this.questionsData = questionsData;
    this.connectedPlayers = new Map();

    // Cleanup interval for abandoned rooms
    setInterval(() => {
      this.cleanupAbandonedRooms();
    }, 60000); // Every minute

    console.log('GameManager initialized with', questionsData.length, 'questions');
  }

  generateRoomId() {
    return uuidv4().split('-')[0].toUpperCase();
  }

  // Handle player connection
  handleConnection(socket) {
    console.log('New player connected:', socket.id);

    this.connectedPlayers.set(socket.id, {
      socket,
      connectedAt: Date.now(),
      currentRoom: null
    });

    // Handle player disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });

    // Handle match finding
    socket.on('findMatch', (playerData) => {
      this.findMatch(socket, playerData);
    });

    // Handle guess submission
    socket.on('submitGuess', ({ guess }) => {
      this.handleGuess(socket, guess);
    });

    // Handle player leaving room
    socket.on('leaveRoom', () => {
      this.handleLeaveRoom(socket);
    });
  }

  // Handle player disconnection
  handleDisconnection(socket) {
    console.log('Player disconnected:', socket.id);

    const playerInfo = this.connectedPlayers.get(socket.id);
    if (playerInfo && playerInfo.currentRoom) {
      const room = this.gameRooms.get(playerInfo.currentRoom);
      if (room) {
        room.removePlayer(socket.id);

        // Notify other players
        if (room.players.length > 0) {
          room.broadcast('playerDisconnected', {
            disconnectedPlayer: socket.id
          });
        }

        // Remove room if empty
        if (room.players.length === 0) {
          this.gameRooms.delete(playerInfo.currentRoom);
          console.log(`Removed empty room: ${playerInfo.currentRoom}`);
        }
      }
    }

    this.connectedPlayers.delete(socket.id);
  }

  // Find match for player - Updated to match by game mode only
  findMatch(socket, playerData) {
    const {
      playerName,
      gameMode = 'general',
      personalCategory = 'general',
      personalCategoryName = 'General Knowledge'
    } = playerData;

    console.log(`Player ${playerName} looking for ${gameMode} match (personal preference: ${personalCategory})`);

    // Look for existing room with same GAME MODE (not category)
    let availableRoom = null;
    for (const room of this.gameRooms.values()) {
      if (room.gameState === 'waiting' &&
          room.players.length === 1 &&
          room.gameMode === gameMode) { // Match by game mode only
        availableRoom = room;
        break;
      }
    }

    if (availableRoom) {
      // Join existing room
      const success = availableRoom.addPlayer(socket, playerName, gameMode, personalCategory);
      if (success) {
        console.log(`Player ${playerName} joined existing ${gameMode} room: ${availableRoom.id}`);

        // Update player info
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

        availableRoom.broadcast('matchFound', {
          players,
          gameMode,
          roomId: availableRoom.id
        });

        // Start game after brief delay
        setTimeout(() => {
          if (availableRoom.players.length === 2 && availableRoom.gameState === 'waiting') {
            availableRoom.startGame();
          }
        }, 2000);

        return;
      }
    }

    // Create new room - Always use 'general' for questions (mixed), gameMode for matching
    const roomId = this.generateRoomId();
    const gameRoom = new GameRoom(roomId, this.questionsData, 'general', gameMode);

    const success = gameRoom.addPlayer(socket, playerName, gameMode, personalCategory);
    if (success) {
      this.gameRooms.set(roomId, gameRoom);

      // Update player info
      const playerInfo = this.connectedPlayers.get(socket.id);
      if (playerInfo) {
        playerInfo.currentRoom = roomId;
      }

      console.log(`Created new ${gameMode} room: ${roomId} for player: ${playerName}`);

      socket.emit('waitingForMatch', {
        roomId,
        gameMode,
        personalCategory,
        personalCategoryName
      });

      // Set timeout for solo players
      setTimeout(() => {
        if (gameRoom.players.length === 1 && gameRoom.gameState === 'waiting') {
          console.log(`Room ${roomId} timeout - removing solo player`);

          // Notify player
          if (gameRoom.players[0] && gameRoom.players[0].socket.connected) {
            gameRoom.players[0].socket.emit('matchTimeout', {
              reason: 'No opponent found within time limit'
            });
          }

          // Clean up
          this.gameRooms.delete(roomId);
          const playerInfo = this.connectedPlayers.get(socket.id);
          if (playerInfo) {
            playerInfo.currentRoom = null;
          }
        }
      }, 120000); // 2 minutes timeout
    } else {
      socket.emit('matchError', {
        error: 'Failed to create or join game room'
      });
    }
  }

  // Handle guess submission
  handleGuess(socket, guess) {
    const playerInfo = this.connectedPlayers.get(socket.id);
    if (!playerInfo || !playerInfo.currentRoom) {
      socket.emit('guessError', { error: 'Not in a game room' });
      return;
    }

    const room = this.gameRooms.get(playerInfo.currentRoom);
    if (!room) {
      socket.emit('guessError', { error: 'Game room not found' });
      return;
    }

    if (room.gameState !== 'playing') {
      socket.emit('guessError', { error: 'Game is not in playing state' });
      return;
    }

    room.handleGuess(socket.id, guess);
  }

  // Handle player leaving room
  handleLeaveRoom(socket) {
    const playerInfo = this.connectedPlayers.get(socket.id);
    if (!playerInfo || !playerInfo.currentRoom) {
      return;
    }

    const room = this.gameRooms.get(playerInfo.currentRoom);
    if (room) {
      room.removePlayer(socket.id);

      // Notify other players
      if (room.players.length > 0) {
        room.broadcast('playerLeft', {
          leftPlayer: socket.id
        });
      }

      // Remove room if empty
      if (room.players.length === 0) {
        this.gameRooms.delete(playerInfo.currentRoom);
        console.log(`Removed empty room: ${playerInfo.currentRoom}`);
      }
    }

    playerInfo.currentRoom = null;
    socket.emit('leftRoom');
  }

  // Clean up abandoned rooms
  cleanupAbandonedRooms() {
    const now = Date.now();
    const roomsToDelete = [];

    for (const [roomId, room] of this.gameRooms.entries()) {
      // Remove rooms that have been empty for more than 5 minutes
      if (room.players.length === 0) {
        roomsToDelete.push(roomId);
        continue;
      }

      // Remove rooms where all players have disconnected
      const hasConnectedPlayers = room.players.some(player =>
        player.socket && player.socket.connected
      );

      if (!hasConnectedPlayers) {
        roomsToDelete.push(roomId);
        continue;
      }

      // Remove waiting rooms that have been waiting for too long (10 minutes)
      if (room.gameState === 'waiting' && room.players.length === 1) {
        const waitTime = now - room.createdAt;
        if (waitTime > 600000) { // 10 minutes
          roomsToDelete.push(roomId);
        }
      }
    }

    // Clean up identified rooms
    roomsToDelete.forEach(roomId => {
      const room = this.gameRooms.get(roomId);
      if (room) {
        console.log(`Cleaning up abandoned room: ${roomId}`);
        room.cleanup();
        this.gameRooms.delete(roomId);
      }
    });

    if (roomsToDelete.length > 0) {
      console.log(`Cleaned up ${roomsToDelete.length} abandoned rooms`);
    }
  }

  // Get game statistics
  getStats() {
    const totalRooms = this.gameRooms.size;
    const totalPlayers = this.connectedPlayers.size;

    const roomStats = {
      waiting: 0,
      playing: 0,
      finished: 0,
      general: 0,
      category: 0
    };

    const playerStats = {
      inGame: 0,
      waiting: 0,
      connected: 0
    };

    // Count rooms by state and mode
    for (const room of this.gameRooms.values()) {
      roomStats[room.gameState] = (roomStats[room.gameState] || 0) + 1;
      roomStats[room.gameMode] = (roomStats[room.gameMode] || 0) + 1;
    }

    // Count players by status
    for (const playerInfo of this.connectedPlayers.values()) {
      playerStats.connected++;
      if (playerInfo.currentRoom) {
        const room = this.gameRooms.get(playerInfo.currentRoom);
        if (room) {
          if (room.gameState === 'playing') {
            playerStats.inGame++;
          } else if (room.gameState === 'waiting') {
            playerStats.waiting++;
          }
        }
      }
    }

    return {
      timestamp: new Date().toISOString(),
      totalRooms,
      totalPlayers,
      roomStats,
      playerStats,
      questionsAvailable: this.questionsData.length
    };
  }

  // Get room details
  getRoomDetails(roomId) {
    const room = this.gameRooms.get(roomId);
    if (!room) {
      return null;
    }

    return room.getStats();
  }

  // Get all active rooms (admin function)
  getAllRooms() {
    const rooms = [];
    for (const [roomId, room] of this.gameRooms.entries()) {
      rooms.push({
        id: roomId,
        ...room.getStats()
      });
    }
    return rooms;
  }

  // Force close room (admin function)
  forceCloseRoom(roomId) {
    const room = this.gameRooms.get(roomId);
    if (!room) {
      return false;
    }

    // Notify all players
    room.broadcast('roomClosed', {
      reason: 'Room closed by administrator'
    });

    // Clean up
    room.cleanup();
    this.gameRooms.delete(roomId);

    // Update player info
    for (const [playerId, playerInfo] of this.connectedPlayers.entries()) {
      if (playerInfo.currentRoom === roomId) {
        playerInfo.currentRoom = null;
      }
    }

    console.log(`Force closed room: ${roomId}`);
    return true;
  }

  // Shutdown manager
  shutdown() {
    console.log('Shutting down GameManager...');

    // Notify all players
    for (const room of this.gameRooms.values()) {
      room.broadcast('serverShutdown', {
        reason: 'Server is shutting down'
      });
      room.cleanup();
    }

    // Clear all data
    this.gameRooms.clear();
    this.connectedPlayers.clear();

    console.log('GameManager shutdown complete');
  }
}

module.exports = GameManager;
