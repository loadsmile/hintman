const GameRoom = require('../models/GameRoom');
const SurvivalRoom = require('../models/SurvivalRoom');
const { v4: uuidv4 } = require('uuid');

class GameManager {
  constructor(questionsData, redisService = null) {
    this.gameRooms = new Map();
    this.survivalRooms = new Map();
    this.questionsData = questionsData;
    this.connectedPlayers = new Map();
    this.disconnectedPlayers = new Map();
    this.redisService = redisService;
    this.disconnectionTimers = new Map();
    this.RECONNECT_GRACE_PERIOD = 60000;

    if (this.redisService) {
      this.autoSaveInterval = setInterval(() => {
        this.saveAllRoomsToRedis();
      }, 30000);
    }
  }

  async saveAllRoomsToRedis() {
    if (!this.redisService) return;

    try {
      for (const [roomId, room] of this.gameRooms.entries()) {
        await this.saveRoomToRedis(room);
      }

      for (const [roomId, room] of this.survivalRooms.entries()) {
        await this.saveSurvivalRoomToRedis(room);
      }
    } catch (error) {
      console.error('Redis save error:', error.message);
    }
  }

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

  async handleReconnection(socket, roomId, playerName) {
    const reconnectKey = `${playerName}:${roomId}`;
    const reconnectInfo = this.disconnectedPlayers.get(reconnectKey);

    if (!reconnectInfo) {
      socket.emit('reconnectFailed', { reason: 'No active game found' });
      return;
    }

    const timerId = this.disconnectionTimers.get(reconnectKey);
    if (timerId) {
      clearTimeout(timerId);
      this.disconnectionTimers.delete(reconnectKey);
    }

    this.disconnectedPlayers.delete(reconnectKey);

    const room = reconnectInfo.roomType === 'survival'
      ? this.survivalRooms.get(roomId)
      : this.gameRooms.get(roomId);

    if (!room) {
      socket.emit('reconnectFailed', { reason: 'Game no longer exists' });
      return;
    }

    const player = room.players.find(p => p.id === reconnectInfo.oldSocketId);
    if (!player) {
      socket.emit('reconnectFailed', { reason: 'Player not found in game' });
      return;
    }

    player.id = socket.id;
    player.socket = socket;

    if (room.health[reconnectInfo.oldSocketId] !== undefined) {
      room.health[socket.id] = room.health[reconnectInfo.oldSocketId];
      delete room.health[reconnectInfo.oldSocketId];
    }

    let playerInfo = this.connectedPlayers.get(socket.id);
    if (!playerInfo) {
      playerInfo = {
        socket,
        connectedAt: Date.now(),
        currentRoom: roomId,
        roomType: reconnectInfo.roomType,
        playerName: playerName
      };
      this.connectedPlayers.set(socket.id, playerInfo);
    } else {
      playerInfo.socket = socket;
      playerInfo.currentRoom = roomId;
      playerInfo.roomType = reconnectInfo.roomType;
      playerInfo.playerName = playerName;
    }

    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });

    socket.on('submitGuess', ({ guess }) => {
      this.handleGuess(socket, guess);
    });

    socket.on('playerReady', () => {
      this.handlePlayerReady(socket);
    });

    socket.on('playerUnready', () => {
      this.handlePlayerUnready(socket);
    });

    room.resumeGame();

    room.broadcast('playerReconnected', {
      playerId: socket.id,
      playerName: playerName,
      message: `${playerName} reconnected. Game resumed.`
    });

    // Build hints array from current question
    const question = room.questions[room.currentQuestion];
    const revealedHints = [];
    for (let i = 0; i < room.currentHintIndex; i++) {
      if (question && i < question.getTotalHints()) {
        revealedHints.push({
          index: i,
          text: question.getHint(i)
        });
      }
    }

    // Get player stats (for Mission Tracker accuracy)
    const getPlayerStats = () => {
      const stats = {};
      room.players.forEach(p => {
        stats[p.id] = {
          correctAnswers: 0,
          mistakes: 0,
          name: p.name
        };
      });
      return stats;
    };

    socket.emit('reconnectSuccess', {
      roomId: roomId,
      gameState: room.gameState,
      currentQuestion: room.currentQuestion + 1,
      totalQuestions: room.questionsPerGame,
      health: room.health,
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        health: room.health[p.id],
        gameMode: p.gameMode,
        personalCategory: p.personalCategory
      })),
      category: question?.category,
      difficulty: question?.difficulty,
      currentHints: room.currentHintIndex,
      hints: revealedHints, // Send all revealed hints
      playerStats: getPlayerStats() // Send player stats for accuracy tracking
    });

    if (this.redisService) {
      if (reconnectInfo.roomType === 'survival') {
        await this.saveSurvivalRoomToRedis(room);
      } else {
        await this.saveRoomToRedis(room);
      }
    }
  }

  async handleDisconnection(socket) {
    const playerInfo = this.connectedPlayers.get(socket.id);

    if (!playerInfo || !playerInfo.currentRoom) {
      this.connectedPlayers.delete(socket.id);
      if (this.redisService) {
        await this.redisService.deletePlayer(socket.id);
      }
      return;
    }

    const room = playerInfo.roomType === 'survival'
      ? this.survivalRooms.get(playerInfo.currentRoom)
      : this.gameRooms.get(playerInfo.currentRoom);

    if (!room) {
      this.connectedPlayers.delete(socket.id);
      return;
    }

    if (room.gameState === 'playing') {
      const player = room.players.find(p => p.id === socket.id);
      const playerName = player?.name || playerInfo.playerName || 'Player';

      const reconnectKey = `${playerName}:${playerInfo.currentRoom}`;

      this.disconnectedPlayers.set(reconnectKey, {
        oldSocketId: socket.id,
        roomId: playerInfo.currentRoom,
        roomType: playerInfo.roomType,
        playerName: playerName,
        disconnectedAt: Date.now()
      });

      room.pauseGame(`${playerName} disconnected`);

      room.broadcast('playerDisconnectedTemporary', {
        playerId: socket.id,
        playerName: playerName,
        reconnectTimeLeft: this.RECONNECT_GRACE_PERIOD / 1000,
        message: `${playerName} disconnected. Waiting ${this.RECONNECT_GRACE_PERIOD / 1000}s for reconnection...`
      });

      const timerId = setTimeout(async () => {
        await this.handlePermanentDisconnection(reconnectKey, socket.id, playerInfo, room);
      }, this.RECONNECT_GRACE_PERIOD);

      this.disconnectionTimers.set(reconnectKey, timerId);

    } else {
      await this.removePlayerFromRoom(socket.id, playerInfo, room);
    }
  }

  async handleReconnection(socket, roomId, playerName) {
    const reconnectKey = `${playerName}:${roomId}`;
    const reconnectInfo = this.disconnectedPlayers.get(reconnectKey);

    if (!reconnectInfo) {
      socket.emit('reconnectFailed', { reason: 'No active game found' });
      return;
    }

    const timerId = this.disconnectionTimers.get(reconnectKey);
    if (timerId) {
      clearTimeout(timerId);
      this.disconnectionTimers.delete(reconnectKey);
    }

    this.disconnectedPlayers.delete(reconnectKey);

    const room = reconnectInfo.roomType === 'survival'
      ? this.survivalRooms.get(roomId)
      : this.gameRooms.get(roomId);

    if (!room) {
      socket.emit('reconnectFailed', { reason: 'Game no longer exists' });
      return;
    }

    const player = room.players.find(p => p.id === reconnectInfo.oldSocketId);
    if (!player) {
      socket.emit('reconnectFailed', { reason: 'Player not found in game' });
      return;
    }

    player.id = socket.id;
    player.socket = socket;

    if (room.health[reconnectInfo.oldSocketId] !== undefined) {
      room.health[socket.id] = room.health[reconnectInfo.oldSocketId];
      delete room.health[reconnectInfo.oldSocketId];
    }

    let playerInfo = this.connectedPlayers.get(socket.id);
    if (!playerInfo) {
      playerInfo = {
        socket,
        connectedAt: Date.now(),
        currentRoom: roomId,
        roomType: reconnectInfo.roomType,
        playerName: playerName
      };
      this.connectedPlayers.set(socket.id, playerInfo);
    } else {
      playerInfo.socket = socket;
      playerInfo.currentRoom = roomId;
      playerInfo.roomType = reconnectInfo.roomType;
      playerInfo.playerName = playerName;
    }

    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });

    socket.on('submitGuess', ({ guess }) => {
      this.handleGuess(socket, guess);
    });

    socket.on('playerReady', () => {
      this.handlePlayerReady(socket);
    });

    socket.on('playerUnready', () => {
      this.handlePlayerUnready(socket);
    });

    room.resumeGame();

    room.broadcast('playerReconnected', {
      playerId: socket.id,
      playerName: playerName,
      message: `${playerName} reconnected. Game resumed.`
    });

    const question = room.questions[room.currentQuestion];
    socket.emit('reconnectSuccess', {
      roomId: roomId,
      gameState: room.gameState,
      currentQuestion: room.currentQuestion + 1,
      totalQuestions: room.questionsPerGame,
      health: room.health,
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        health: room.health[p.id]
      })),
      category: question?.category,
      difficulty: question?.difficulty,
      currentHints: room.currentHintIndex
    });

    if (this.redisService) {
      if (reconnectInfo.roomType === 'survival') {
        await this.saveSurvivalRoomToRedis(room);
      } else {
        await this.saveRoomToRedis(room);
      }
    }
  }

  async handlePermanentDisconnection(reconnectKey, oldSocketId, playerInfo, room) {
    this.disconnectionTimers.delete(reconnectKey);
    this.disconnectedPlayers.delete(reconnectKey);

    const player = room.players.find(p => p.id === oldSocketId);
    const playerName = player?.name || 'Player';

    room.broadcast('playerDisconnectedPermanent', {
      playerId: oldSocketId,
      playerName: playerName,
      message: `${playerName} did not reconnect.`
    });

    if (playerInfo.roomType === 'survival') {
      room.removePlayer(oldSocketId);

      if (room.players.length === 0) {
        this.survivalRooms.delete(playerInfo.currentRoom);
        if (this.redisService) {
          await this.redisService.deleteSurvivalRoom(playerInfo.currentRoom);
        }
      } else {
        room.resumeGame();
        if (this.redisService) {
          await this.saveSurvivalRoomToRedis(room);
        }
      }
    } else {
      room.removePlayer(oldSocketId);

      if (room.players.length === 1) {
        room.endGame();
      }

      if (room.players.length === 0) {
        this.gameRooms.delete(playerInfo.currentRoom);
        if (this.redisService) {
          await this.redisService.deleteRoom(playerInfo.currentRoom);
        }
      } else if (this.redisService) {
        await this.saveRoomToRedis(room);
      }
    }

    this.connectedPlayers.delete(oldSocketId);
    if (this.redisService) {
      await this.redisService.deletePlayer(oldSocketId);
    }
  }

  async removePlayerFromRoom(socketId, playerInfo, room) {
    room.removePlayer(socketId);

    if (playerInfo.roomType === 'survival') {
      if (room.players.length > 0) {
        room.broadcast('playerUnready', {
          playerId: socketId,
          readyPlayers: room.getReadyPlayerIds()
        });
      }

      if (room.players.length === 0) {
        this.survivalRooms.delete(playerInfo.currentRoom);
        if (this.redisService) {
          await this.redisService.deleteSurvivalRoom(playerInfo.currentRoom);
        }
      } else if (this.redisService) {
        await this.saveSurvivalRoomToRedis(room);
      }
    } else {
      if (room.players.length > 0) {
        room.broadcast('playerDisconnected', {
          disconnectedPlayer: socketId
        });
      }

      if (room.players.length === 0) {
        this.gameRooms.delete(playerInfo.currentRoom);
        if (this.redisService) {
          await this.redisService.deleteRoom(playerInfo.currentRoom);
        }
      } else if (this.redisService) {
        await this.saveRoomToRedis(room);
      }
    }

    this.connectedPlayers.delete(socketId);
    if (this.redisService) {
      await this.redisService.deletePlayer(socketId);
    }
  }

  async handlePlayerReady(socket) {
    const playerInfo = this.connectedPlayers.get(socket.id);
    if (!playerInfo || !playerInfo.currentRoom || playerInfo.roomType !== 'survival') {
      return;
    }

    const room = this.survivalRooms.get(playerInfo.currentRoom);
    if (!room) return;

    const success = room.setPlayerReady(socket.id, true);
    if (!success) return;

    if (this.redisService) {
      await this.saveSurvivalRoomToRedis(room);
    }

    room.broadcast('playerReady', {
      playerId: socket.id,
      readyPlayers: room.getReadyPlayerIds()
    });

    if (room.areAllPlayersReady()) {
      room.broadcast('allPlayersReady');

      setTimeout(async () => {
        if (room.canStartGame() && room.gameState === 'waiting') {
          room.startGame();
          if (this.redisService) {
            await this.saveSurvivalRoomToRedis(room);
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

    if (this.redisService) {
      await this.saveSurvivalRoomToRedis(room);
    }

    room.broadcast('playerUnready', {
      playerId: socket.id,
      readyPlayers: room.getReadyPlayerIds()
    });
  }

  async findMatch(socket, playerData) {
    const {
      playerName,
      gameMode = 'general',
      personalCategory = 'general',
      personalCategoryName = 'General Knowledge'
    } = playerData;

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
          playerInfo.playerName = playerName;

          if (this.redisService) {
            await this.redisService.savePlayerInfo(socket.id, playerInfo);
          }
        }

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

    const roomId = uuidv4().split('-')[0].toUpperCase();
    const gameRoom = new GameRoom(roomId, this.questionsData, personalCategory, gameMode);

    const success = gameRoom.addPlayer(socket, playerName, gameMode, personalCategory);
    if (success) {
      this.gameRooms.set(roomId, gameRoom);

      const playerInfo = this.connectedPlayers.get(socket.id);
      if (playerInfo) {
        playerInfo.currentRoom = roomId;
        playerInfo.roomType = 'regular';
        playerInfo.playerName = playerName;

        if (this.redisService) {
          await this.redisService.savePlayerInfo(socket.id, playerInfo);
        }
      }

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

    let availableRoom = null;
    for (const room of this.survivalRooms.values()) {
      if (room.gameState === 'waiting' && room.players.length < room.maxPlayers) {
        availableRoom = room;
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
          playerInfo.playerName = playerName;

          if (this.redisService) {
            await this.redisService.savePlayerInfo(socket.id, playerInfo);
          }
        }

        if (this.redisService) {
          await this.saveSurvivalRoomToRedis(availableRoom);
        }

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

        return;
      }
    }

    const roomId = `SURVIVAL-${uuidv4().split('-')[0].toUpperCase()}`;
    const survivalRoom = new SurvivalRoom(roomId, this.questionsData, personalCategory, gameMode);

    const success = survivalRoom.addPlayer(socket, playerName, gameMode, personalCategory);
    if (success) {
      this.survivalRooms.set(roomId, survivalRoom);

      const playerInfo = this.connectedPlayers.get(socket.id);
      if (playerInfo) {
        playerInfo.currentRoom = roomId;
        playerInfo.roomType = 'survival';
        playerInfo.playerName = playerName;

        if (this.redisService) {
          await this.redisService.savePlayerInfo(socket.id, playerInfo);
        }
      }

      if (this.redisService) {
        await this.saveSurvivalRoomToRedis(survivalRoom);
      }

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
          survivalRoom.players.forEach(player => {
            if (player.socket && player.socket.connected) {
              player.socket.emit('matchTimeout');
            }
          });
          this.survivalRooms.delete(roomId);

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
      paused: 0,
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

    return {
      totalRooms,
      totalPlayers,
      disconnectedPlayers: this.disconnectedPlayers.size,
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
      this.gameRooms.delete(roomId);
      if (this.redisService) {
        await this.redisService.deleteRoom(roomId);
      }
    }

    for (const roomId of survivalRoomsToDelete) {
      this.survivalRooms.delete(roomId);
      if (this.redisService) {
        await this.redisService.deleteSurvivalRoom(roomId);
      }
    }
  }

  async shutdown() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    for (const timerId of this.disconnectionTimers.values()) {
      clearTimeout(timerId);
    }
    this.disconnectionTimers.clear();

    if (this.redisService) {
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
    this.disconnectedPlayers.clear();
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
}

module.exports = GameManager;
