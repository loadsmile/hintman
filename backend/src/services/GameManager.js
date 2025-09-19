const GameRoom = require('../models/GameRoom');
const { v4: uuidv4 } = require('uuid');

class GameManager {
  constructor(questionsData) {
    this.gameRooms = new Map();
    this.questionsData = questionsData;
    this.connectedPlayers = new Map();
  }

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

  handleDisconnection(socket) {
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

  findMatch(socket, playerData) {
    const {
      playerName,
      gameMode = 'general',
      personalCategory = 'general',
      personalCategoryName = 'General Knowledge'
    } = playerData;

    // For Under Cover Mission, match only by game mode (not category)
    // This allows players with different categories to match
    let availableRoom = null;
    for (const room of this.gameRooms.values()) {
      if (room.gameState === 'waiting' &&
          room.players.length === 1 &&
          room.gameMode === gameMode) {

        // For category mode, ensure we don't match players with the same category
        // This encourages diversity in question selection
        if (gameMode === 'category') {
          const existingPlayer = room.players[0];
          if (existingPlayer.personalCategory !== personalCategory) {
            availableRoom = room;
            break;
          }
        } else {
          availableRoom = room;
          break;
        }
      }
    }

    if (availableRoom) {
      const success = availableRoom.addPlayer(socket, playerName, gameMode, personalCategory);
      if (success) {
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

        // Enhanced category info for both players
        const categoryInfo = gameMode === 'category' ? {
          player1Category: availableRoom.players[0].personalCategory,
          player2Category: availableRoom.players[1].personalCategory,
          questionsPerGame: 10,
          mixStrategy: `5 questions from ${availableRoom.players[0].personalCategory} + 5 from ${availableRoom.players[1].personalCategory}`,
          categoryMix: availableRoom.categoryMix
        } : {
          questionsPerGame: 5,
          mixStrategy: 'General knowledge questions'
        };

        availableRoom.broadcast('matchFound', {
          players,
          gameMode,
          categoryInfo
        });

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
    const gameRoom = new GameRoom(roomId, this.questionsData, personalCategory, gameMode);

    const success = gameRoom.addPlayer(socket, playerName, gameMode, personalCategory);
    if (success) {
      this.gameRooms.set(roomId, gameRoom);

      const playerInfo = this.connectedPlayers.get(socket.id);
      if (playerInfo) {
        playerInfo.currentRoom = roomId;
      }

      socket.emit('waitingForMatch', {
        roomId,
        gameMode,
        personalCategory,
        personalCategoryName
      });

      // Auto-cleanup waiting rooms after 2 minutes
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

  getWaitingPlayersCount() {
    let count = 0;
    for (const room of this.gameRooms.values()) {
      if (room.gameState === 'waiting') {
        count += room.players.length;
      }
    }
    return count;
  }

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

    for (const room of this.gameRooms.values()) {
      roomStats[room.gameState] = (roomStats[room.gameState] || 0) + 1;
      roomStats[room.gameMode] = (roomStats[room.gameMode] || 0) + 1;
    }

    return {
      totalRooms,
      totalPlayers,
      roomStats,
      questionsAvailable: this.questionsData.length
    };
  }

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

  shutdown() {
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
