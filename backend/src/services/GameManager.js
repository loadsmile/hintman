const GameRoom = require('../models/GameRoom');
const SurvivalRoom = require('../models/SurvivalRoom');
const { v4: uuidv4 } = require('uuid');

class GameManager {
  constructor(questionsData, redisService = null) {
    this.gameRooms = new Map();
    this.survivalRooms = new Map();
    this.questionsData = questionsData;
    this.connectedPlayers = new Map();
    this.redisService = redisService; // NEW: Redis service

    // NEW: Auto-save interval (every 30 seconds)
    if (this.redisService) {
      this.autoSaveInterval = setInterval(() => {
        this.saveAllRoomsToRedis();
      }, 30000);
      console.log('✅ GameManager: Auto-save to Redis enabled (every 30s)');
    }
  }

  // NEW: Save all active rooms to Redis
  async saveAllRoomsToRedis() {
    if (!this.redisService) return;

    try {
      // Save regular rooms
      for (const [roomId, room] of this.gameRooms.entries()) {
        await this.saveRoomToRedis(room);
      }

      // Save survival rooms
      for (const [roomId, room] of this.survivalRooms.entries()) {
        await this.saveSurvivalRoomToRedis(room);
      }
    } catch (error) {
      console.error('❌ Error in auto-save:', error);
    }
  }

  // NEW: Save individual room to Redis
  async saveRoomToRedis(room) {
    if (!this.redisService) return false;

    const roomData = {
      id: room.id,
      gameMode: room.gameMode,
      gameState: room.gameState,
      currentQuestion: room.currentQuestion,
      currentHintIndex: room.currentHintIndex,
      questionsPerGame: room.questionsPerGame,
      questionAnswered: room.questionAnswered,
      createdAt: room.createdAt,
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        health: p.health,
        gameMode: p.gameMode,
        personalCategory: p.personalCategory
      })),
      questions: room.questions,
      health: room.health,
      playerCategories: room.playerCategories,
      categoryMix: room.categoryMix
    };

    return await this.redisService.saveRoom(room.id, roomData);
  }

  // NEW: Save survival room to Redis
  async saveSurvivalRoomToRedis(room) {
    if (!this.redisService) return false;

    const roomData = {
      id: room.id,
      gameMode: room.gameMode || 'survival',
      gameState: room.gameState,
      currentQuestion: room.currentQuestion,
      currentHintIndex: room.currentHintIndex,
      questionsPerGame: room.questionsPerGame,
      maxPlayers: room.maxPlayers,
      questionAnswered: room.questionAnswered,
      createdAt: room.createdAt,
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        health: p.health,
        gameMode: p.gameMode,
        personalCategory: p.personalCategory
      })),
      questions: room.questions,
      health: room.health,
      readyPlayers: Array.from(room.readyPlayers || []),
      eliminatedPlayers: Array.from(room.eliminatedPlayers || [])
    };

    return await this.redisService.saveSurvivalRoom(room.id, roomData);
  }

  // NEW: Load room from Redis
  async loadRoomFromRedis(roomId) {
    if (!this.redisService) return null;

    const roomData = await this.redisService.getRoom(roomId);
    if (!roomData) return null;

    // Reconstruct GameRoom object
    const room = new GameRoom(roomData.id, this.questionsData, roomData.playerCategories[0], roomData.gameMode);
    room.gameState = roomData.gameState;
    room.currentQuestion = roomData.currentQuestion;
    room.currentHintIndex = roomData.currentHintIndex;
    room.questionsPerGame = roomData.questionsPerGame;
    room.questionAnswered = roomData.questionAnswered;
    room.createdAt = roomData.createdAt;
    room.questions = roomData.questions;
    room.health = roomData.health;
    room.playerCategories = roomData.playerCategories;
    room.categoryMix = roomData.categoryMix;

    // Note: Players will need to reconnect, sockets can't be serialized
    console.log(`📥 Loaded room ${roomId} from Redis`);
    return room;
  }

  // NEW: Load survival room from Redis
  async loadSurvivalRoomFromRedis(roomId) {
    if (!this.redisService) return null;

    const roomData = await this.redisService.getSurvivalRoom(roomId);
    if (!roomData) return null;

    // Reconstruct SurvivalRoom object
    const room = new SurvivalRoom(roomData.id, this.questionsData, 'general', 'survival');
    room.gameState = roomData.gameState;
    room.currentQuestion = roomData.currentQuestion;
    room.currentHintIndex = roomData.currentHintIndex;
    room.questionsPerGame = roomData.questionsPerGame;
    room.maxPlayers = roomData.maxPlayers;
    room.questionAnswered = roomData.questionAnswered;
    room.createdAt = roomData.createdAt;
    room.questions = roomData.questions;
    room.health = roomData.health;
    room.readyPlayers = roomData.readyPlayers;
    room.eliminatedPlayers = roomData.eliminatedPlayers;

    console.log(`📥 Loaded survival room ${roomId} from Redis`);
    return room;
  }

  handleConnection(socket) {
    this.connectedPlayers.set(socket.id, {
      socket,
      connectedAt: Date.now(),
      currentRoom: null,
      roomType: null
    });

    // NEW: Save player to Redis
    if (this.redisService) {
      this.redisService.savePlayerInfo(socket.id, {
        connectedAt: Date.now(),
        currentRoom: null,
        roomType: null
      });
    }

    console.log(`🔗 Player connected: ${socket.id}`);

    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });

    socket.on('findMatch', (playerData) => {
      this.findMatch(socket, playerData);
    });

    socket.on('findSurvivalMatch', (playerData) => {
      this.findSurvivalMatch(socket, playerData);
    });

    socket.on('playerReady', () => {
      this.handlePlayerReady(socket);
    });

    socket.on('playerUnready', () => {
      this.handlePlayerUnready(socket);
    });

    socket.on('submitGuess', ({ guess }) => {
      this.handleGuess(socket, guess);
    });
  }

  async handleDisconnection(socket) {
    const playerInfo = this.connectedPlayers.get(socket.id);
    console.log(`🔗 Player disconnected: ${socket.id}`);

    if (playerInfo && playerInfo.currentRoom) {
      if (playerInfo.roomType === 'survival') {
        const room = this.survivalRooms.get(playerInfo.currentRoom);
        if (room) {
          console.log(`🎯 Removing player from survival room: ${playerInfo.currentRoom}`);
          room.removePlayer(socket.id);

          // Save to Redis after player removal
          if (this.redisService) {
            await this.saveSurvivalRoomToRedis(room);
          }

          if (room.players.length > 0) {
            room.broadcast('playerUnready', {
              playerId: socket.id,
              readyPlayers: room.getReadyPlayerIds()
            });
          }

          if (room.players.length === 0) {
            this.survivalRooms.delete(playerInfo.currentRoom);
            // Delete from Redis
            if (this.redisService) {
              await this.redisService.deleteSurvivalRoom(playerInfo.currentRoom);
            }
            console.log(`🎯 Deleted empty survival room: ${playerInfo.currentRoom}`);
          }
        }
      } else {
        const room = this.gameRooms.get(playerInfo.currentRoom);
        if (room) {
          room.removePlayer(socket.id);

          // Save to Redis after player removal
          if (this.redisService) {
            await this.saveRoomToRedis(room);
          }

          if (room.players.length > 0) {
            room.broadcast('playerDisconnected', {
              disconnectedPlayer: socket.id
            });
          }

          if (room.players.length === 0) {
            this.gameRooms.delete(playerInfo.currentRoom);
            // Delete from Redis
            if (this.redisService) {
              await this.redisService.deleteRoom(playerInfo.currentRoom);
            }
          }
        }
      }
    }

    this.connectedPlayers.delete(socket.id);

    // Delete player from Redis
    if (this.redisService) {
      await this.redisService.deletePlayer(socket.id);
    }
  }

  async handlePlayerReady(socket) {
    const playerInfo = this.connectedPlayers.get(socket.id);
    if (!playerInfo || !playerInfo.currentRoom || playerInfo.roomType !== 'survival') {
      console.log(`❌ Player ${socket.id} tried to ready but not in survival room`);
      return;
    }

    const room = this.survivalRooms.get(playerInfo.currentRoom);
    if (!room) {
      console.log(`❌ Room not found for player ${socket.id}`);
      return;
    }

    const success = room.setPlayerReady(socket.id, true);
    if (!success) {
      console.log(`❌ Failed to set player ${socket.id} as ready`);
      return;
    }

    // Save to Redis after ready state change
    if (this.redisService) {
      await this.saveSurvivalRoomToRedis(room);
    }

    room.broadcast('playerReady', {
      playerId: socket.id,
      readyPlayers: room.getReadyPlayerIds()
    });

    console.log(`✅ Player ${socket.id} is ready (${room.readyPlayers.size}/${room.players.length})`);

    if (room.areAllPlayersReady()) {
      console.log(`🚀 ALL PLAYERS READY in room ${room.id} - Starting game!`);
      room.broadcast('allPlayersReady');

      setTimeout(async () => {
        if (room.canStartGame() && room.gameState === 'waiting') {
          const started = room.startGame();
          if (started && this.redisService) {
            await this.saveSurvivalRoomToRedis(room);
          }
          if (!started) {
            console.error(`❌ Failed to start game in room ${room.id}`);
          }
        }
      }, 3000);
    }
  }

  async handlePlayerUnready(socket) {
    const playerInfo = this.connectedPlayers.get(socket.id);
    if (!playerInfo || !playerInfo.currentRoom || playerInfo.roomType !== 'survival') {
      return;
    }

    const room = this.survivalRooms.get(playerInfo.currentRoom);
    if (!room) return;

    room.setPlayerReady(socket.id, false);

    // Save to Redis after unready state change
    if (this.redisService) {
      await this.saveSurvivalRoomToRedis(room);
    }

    room.broadcast('playerUnready', {
      playerId: socket.id,
      readyPlayers: room.getReadyPlayerIds()
    });

    console.log(`⏳ Player ${socket.id} is NOT ready (${room.readyPlayers.size}/${room.players.length})`);
  }

  async findMatch(socket, playerData) {
    const {
      playerName,
      gameMode = 'general',
      personalCategory = 'general',
      personalCategoryName = 'General Knowledge'
    } = playerData;

    console.log(`🎯 Finding regular match for ${playerName} (${gameMode})`);

    let availableRoom = null;
    for (const room of this.gameRooms.values()) {
      if (room.gameState === 'waiting' &&
          room.players.length === 1 &&
          room.gameMode === gameMode) {

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
          playerInfo.roomType = 'regular';

          // Save player info to Redis
          if (this.redisService) {
            await this.redisService.savePlayerInfo(socket.id, playerInfo);
          }
        }

        // Save room to Redis
        if (this.redisService) {
          await this.saveRoomToRedis(availableRoom);
        }

        const players = availableRoom.players.map(p => ({
          id: p.id,
          name: p.name,
          gameMode: p.gameMode,
          personalCategory: p.personalCategory
        }));

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

        setTimeout(async () => {
          if (availableRoom.players.length === 2 && availableRoom.gameState === 'waiting') {
            availableRoom.startGame();
            if (this.redisService) {
              await this.saveRoomToRedis(availableRoom);
            }
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
        playerInfo.roomType = 'regular';

        // Save player info to Redis
        if (this.redisService) {
          await this.redisService.savePlayerInfo(socket.id, playerInfo);
        }
      }

      // Save new room to Redis
      if (this.redisService) {
        await this.saveRoomToRedis(gameRoom);
      }

      socket.emit('waitingForMatch', {
        roomId,
        gameMode,
        personalCategory,
        personalCategoryName
      });

      setTimeout(async () => {
        if (gameRoom.players.length === 1 && gameRoom.gameState === 'waiting') {
          if (gameRoom.players[0] && gameRoom.players[0].socket.connected) {
            gameRoom.players[0].socket.emit('matchTimeout');
          }
          this.gameRooms.delete(roomId);

          // Delete from Redis
          if (this.redisService) {
            await this.redisService.deleteRoom(roomId);
          }
        }
      }, 120000);
    }
  }

  async findSurvivalMatch(socket, playerData) {
    const {
      playerName,
      gameMode = 'survival',
      personalCategory = 'general',
      personalCategoryName = 'General Knowledge'
    } = playerData;

    console.log(`🎯 Finding survival match for ${playerName}`);

    let availableRoom = null;
    for (const room of this.survivalRooms.values()) {
      if (room.gameState === 'waiting' && room.players.length < room.maxPlayers) {
        availableRoom = room;
        console.log(`🎯 Found available survival room: ${room.id} (${room.players.length}/${room.maxPlayers})`);
        break;
      }
    }

    if (availableRoom) {
      const success = availableRoom.addPlayer(socket, playerName, gameMode, personalCategory);
      if (success) {
        const playerInfo = this.connectedPlayers.get(socket.id);
        if (playerInfo) {
          playerInfo.currentRoom = availableRoom.id;
          playerInfo.roomType = 'survival';

          // Save player info to Redis
          if (this.redisService) {
            await this.redisService.savePlayerInfo(socket.id, playerInfo);
          }
        }

        // Save room to Redis
        if (this.redisService) {
          await this.saveSurvivalRoomToRedis(availableRoom);
        }

        console.log(`🎯 Player ${playerName} joined survival room ${availableRoom.id} (${availableRoom.players.length}/${availableRoom.maxPlayers})`);

        const players = availableRoom.players.map(p => ({
          id: p.id,
          name: p.name,
          gameMode: p.gameMode,
          personalCategory: p.personalCategory
        }));

        availableRoom.broadcast('matchFound', {
          players,
          gameMode: 'survival',
          categoryInfo: {
            questionsPerGame: 20,
            mixStrategy: 'Mixed categories for survival challenge',
            gameType: 'Battle Royale'
          }
        });

        console.log(`🎯 Sent matchFound to ${availableRoom.players.length} players - they should be in lobby now`);

        return;
      }
    }

    // Create new survival room
    const roomId = `SURVIVAL-${uuidv4().split('-')[0].toUpperCase()}`;
    const survivalRoom = new SurvivalRoom(roomId, this.questionsData, personalCategory, gameMode);

    const success = survivalRoom.addPlayer(socket, playerName, gameMode, personalCategory);
    if (success) {
      this.survivalRooms.set(roomId, survivalRoom);

      const playerInfo = this.connectedPlayers.get(socket.id);
      if (playerInfo) {
        playerInfo.currentRoom = roomId;
        playerInfo.roomType = 'survival';

        // Save player info to Redis
        if (this.redisService) {
          await this.redisService.savePlayerInfo(socket.id, playerInfo);
        }
      }

      // Save new survival room to Redis
      if (this.redisService) {
        await this.saveSurvivalRoomToRedis(survivalRoom);
      }

      console.log(`🎯 Created new survival room ${roomId} for player ${playerName}`);

      socket.emit('waitingForMatch', {
        roomId,
        playersInRoom: 1,
        maxPlayers: survivalRoom.maxPlayers,
        gameMode: 'survival',
        personalCategory,
        personalCategoryName
      });

      setTimeout(async () => {
        if (survivalRoom.players.length < 2 && survivalRoom.gameState === 'waiting') {
          console.log(`🎯 Auto-cleaning up survival room ${roomId} due to timeout`);
          survivalRoom.players.forEach(player => {
            if (player.socket && player.socket.connected) {
              player.socket.emit('matchTimeout');
            }
          });
          this.survivalRooms.delete(roomId);

          // Delete from Redis
          if (this.redisService) {
            await this.redisService.deleteSurvivalRoom(roomId);
          }
        }
      }, 300000);
    }
  }

  async handleGuess(socket, guess) {
    const playerInfo = this.connectedPlayers.get(socket.id);
    if (!playerInfo || !playerInfo.currentRoom) {
      return;
    }

    let room = null;
    if (playerInfo.roomType === 'survival') {
      room = this.survivalRooms.get(playerInfo.currentRoom);
    } else {
      room = this.gameRooms.get(playerInfo.currentRoom);
    }

    if (!room || room.gameState !== 'playing') {
      return;
    }

    room.handleGuess(socket.id, guess);

    // Save room state to Redis after guess
    if (this.redisService) {
      if (playerInfo.roomType === 'survival') {
        await this.saveSurvivalRoomToRedis(room);
      } else {
        await this.saveRoomToRedis(room);
      }
    }
  }

  getWaitingPlayersCount() {
    let count = 0;
    for (const room of this.gameRooms.values()) {
      if (room.gameState === 'waiting') {
        count += room.players.length;
      }
    }
    for (const room of this.survivalRooms.values()) {
      if (room.gameState === 'waiting') {
        count += room.players.length;
      }
    }
    return count;
  }

  getStats() {
    const totalRooms = this.gameRooms.size + this.survivalRooms.size;
    const totalPlayers = this.connectedPlayers.size;

    const roomStats = {
      waiting: 0,
      playing: 0,
      finished: 0,
      general: 0,
      category: 0,
      survival: 0
    };

    for (const room of this.gameRooms.values()) {
      roomStats[room.gameState] = (roomStats[room.gameState] || 0) + 1;
      roomStats[room.gameMode] = (roomStats[room.gameMode] || 0) + 1;
    }

    for (const room of this.survivalRooms.values()) {
      roomStats[room.gameState] = (roomStats[room.gameState] || 0) + 1;
      roomStats.survival = (roomStats.survival || 0) + 1;
    }

    console.log(`📊 GameManager Stats: ${totalPlayers} players, ${totalRooms} rooms (${roomStats.survival} survival)`);

    return {
      totalRooms,
      totalPlayers,
      roomStats,
      questionsAvailable: this.questionsData.length,
      survivalRoomsActive: this.survivalRooms.size,
      regularRoomsActive: this.gameRooms.size,
      redisPersistence: this.redisService ? 'enabled' : 'disabled'
    };
  }

  async cleanupAbandonedRooms() {
    const regularRoomsToDelete = [];
    const survivalRoomsToDelete = [];

    for (const [roomId, room] of this.gameRooms.entries()) {
      if (room.players.length === 0) {
        regularRoomsToDelete.push(roomId);
      }
    }

    for (const [roomId, room] of this.survivalRooms.entries()) {
      if (room.players.length === 0) {
        survivalRoomsToDelete.push(roomId);
      }
    }

    for (const roomId of regularRoomsToDelete) {
      console.log(`🗑️ Cleaning up empty regular room: ${roomId}`);
      this.gameRooms.delete(roomId);
      if (this.redisService) {
        await this.redisService.deleteRoom(roomId);
      }
    }

    for (const roomId of survivalRoomsToDelete) {
      console.log(`🗑️ Cleaning up empty survival room: ${roomId}`);
      this.survivalRooms.delete(roomId);
      if (this.redisService) {
        await this.redisService.deleteSurvivalRoom(roomId);
      }
    }

    if (regularRoomsToDelete.length > 0 || survivalRoomsToDelete.length > 0) {
      console.log(`🗑️ Cleaned up ${regularRoomsToDelete.length} regular rooms and ${survivalRoomsToDelete.length} survival rooms`);
    }
  }

  async shutdown() {
    console.log('🔥 GameManager shutting down...');

    // Stop auto-save interval
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    // Final save to Redis before shutdown
    if (this.redisService) {
      console.log('💾 Final save to Redis before shutdown...');
      await this.saveAllRoomsToRedis();
    }

    for (const room of this.gameRooms.values()) {
      if (room.broadcast) {
        room.broadcast('serverShutdown', { reason: 'Server maintenance' });
      }
      if (room.cleanup) {
        room.cleanup();
      }
    }

    for (const room of this.survivalRooms.values()) {
      if (room.broadcast) {
        room.broadcast('serverShutdown', { reason: 'Server maintenance' });
      }
      if (room.cleanup) {
        room.cleanup();
      }
    }

    this.gameRooms.clear();
    this.survivalRooms.clear();
    this.connectedPlayers.clear();

    console.log('🔥 GameManager shutdown complete');
  }

  getSurvivalRoomsInfo() {
    const roomsInfo = [];
    for (const [roomId, room] of this.survivalRooms.entries()) {
      roomsInfo.push({
        id: roomId,
        players: room.players.length,
        maxPlayers: room.maxPlayers,
        state: room.gameState,
        readyCount: room.readyPlayers?.size || 0,
        playerNames: room.players.map(p => p.name)
      });
    }
    return roomsInfo;
  }

  logDebugInfo() {
    console.log('🎯 === GAMEMANAGER DEBUG INFO ===');
    console.log(`Connected Players: ${this.connectedPlayers.size}`);
    console.log(`Regular Rooms: ${this.gameRooms.size}`);
    console.log(`Survival Rooms: ${this.survivalRooms.size}`);
    console.log(`Redis Persistence: ${this.redisService ? 'ENABLED ✅' : 'DISABLED ❌'}`);

    if (this.survivalRooms.size > 0) {
      console.log('🎯 Survival Rooms Details:');
      this.getSurvivalRoomsInfo().forEach(room => {
        console.log(`  - ${room.id}: ${room.players}/${room.maxPlayers} players (${room.state}) - Ready: ${room.readyCount} - [${room.playerNames.join(', ')}]`);
      });
    }
    console.log('🎯 ================================');
  }
}

module.exports = GameManager;
