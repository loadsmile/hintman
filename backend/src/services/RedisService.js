const redis = require('redis');

class RedisService {
  constructor(redisUrl, existingClient = null) {
    if (existingClient) {
      // Use existing connected client (shared with Socket.IO adapter)
      this.client = existingClient;
      this.isConnected = true;
      this.isSharedClient = true;
      console.log('✅ RedisService using shared client');
    } else {
      // Create new client
      this.client = redis.createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              return new Error('Redis connection failed after 10 retries');
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.client.on('error', (err) => console.error('❌ Redis Client Error:', err));
      this.client.on('connect', () => console.log('✅ Redis Client Connected'));
      this.client.on('ready', () => console.log('✅ Redis Client Ready'));
      this.client.on('reconnecting', () => console.log('🔄 Redis Client Reconnecting...'));

      this.isConnected = false;
      this.isSharedClient = false;
    }
  }

  async connect() {
    if (this.isSharedClient) {
      console.log('✅ RedisService ready (using shared connection)');
      return;
    }

    if (!this.isConnected) {
      await this.client.connect();
      this.isConnected = true;
      console.log('✅ RedisService connected');
    }
  }

  async disconnect() {
    if (this.isSharedClient) {
      console.log('⚠️  Skipping disconnect (shared Redis client)');
      return;
    }

    if (this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      console.log('🔒 RedisService disconnected');
    }
  }

  // ===== ROOM OPERATIONS =====

  async saveRoom(roomId, roomData) {
    try {
      const key = `room:${roomId}`;
      await this.client.hSet(key, {
        id: roomData.id,
        gameMode: roomData.gameMode,
        gameState: roomData.gameState,
        currentQuestion: roomData.currentQuestion.toString(),
        currentHintIndex: roomData.currentHintIndex.toString(),
        questionsPerGame: roomData.questionsPerGame.toString(),
        questionAnswered: roomData.questionAnswered.toString(),
        createdAt: roomData.createdAt.toString(),
        players: JSON.stringify(roomData.players),
        questions: JSON.stringify(roomData.questions),
        health: JSON.stringify(roomData.health),
        playerCategories: JSON.stringify(roomData.playerCategories || []),
        categoryMix: JSON.stringify(roomData.categoryMix || [])
      });

      await this.client.expire(key, 7200);
      return true;
    } catch (error) {
      console.error(`❌ Error saving room ${roomId}:`, error);
      return false;
    }
  }

  async getRoom(roomId) {
    try {
      const key = `room:${roomId}`;
      const data = await this.client.hGetAll(key);

      if (!data || Object.keys(data).length === 0) {
        return null;
      }

      return {
        id: data.id,
        gameMode: data.gameMode,
        gameState: data.gameState,
        currentQuestion: parseInt(data.currentQuestion),
        currentHintIndex: parseInt(data.currentHintIndex),
        questionsPerGame: parseInt(data.questionsPerGame),
        questionAnswered: data.questionAnswered === 'true',
        createdAt: parseInt(data.createdAt),
        players: JSON.parse(data.players),
        questions: JSON.parse(data.questions),
        health: JSON.parse(data.health),
        playerCategories: JSON.parse(data.playerCategories || '[]'),
        categoryMix: JSON.parse(data.categoryMix || '[]')
      };
    } catch (error) {
      console.error(`❌ Error getting room ${roomId}:`, error);
      return null;
    }
  }

  async deleteRoom(roomId) {
    try {
      const key = `room:${roomId}`;
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting room ${roomId}:`, error);
      return false;
    }
  }

  async getAllRoomIds() {
    try {
      const keys = await this.client.keys('room:*');
      return keys.map(key => key.replace('room:', ''));
    } catch (error) {
      console.error('❌ Error getting all room IDs:', error);
      return [];
    }
  }

  // ===== SURVIVAL ROOM OPERATIONS =====

  async saveSurvivalRoom(roomId, roomData) {
    try {
      const key = `survival:${roomId}`;
      await this.client.hSet(key, {
        id: roomData.id,
        gameMode: roomData.gameMode || 'survival',
        gameState: roomData.gameState,
        currentQuestion: roomData.currentQuestion.toString(),
        currentHintIndex: roomData.currentHintIndex.toString(),
        questionsPerGame: roomData.questionsPerGame.toString(),
        maxPlayers: roomData.maxPlayers.toString(),
        questionAnswered: roomData.questionAnswered.toString(),
        createdAt: roomData.createdAt.toString(),
        players: JSON.stringify(roomData.players),
        questions: JSON.stringify(roomData.questions),
        health: JSON.stringify(roomData.health),
        readyPlayers: JSON.stringify(Array.from(roomData.readyPlayers || [])),
        eliminatedPlayers: JSON.stringify(Array.from(roomData.eliminatedPlayers || []))
      });

      await this.client.expire(key, 7200);
      return true;
    } catch (error) {
      console.error(`❌ Error saving survival room ${roomId}:`, error);
      return false;
    }
  }

  async getSurvivalRoom(roomId) {
    try {
      const key = `survival:${roomId}`;
      const data = await this.client.hGetAll(key);

      if (!data || Object.keys(data).length === 0) {
        return null;
      }

      return {
        id: data.id,
        gameMode: data.gameMode || 'survival',
        gameState: data.gameState,
        currentQuestion: parseInt(data.currentQuestion),
        currentHintIndex: parseInt(data.currentHintIndex),
        questionsPerGame: parseInt(data.questionsPerGame),
        maxPlayers: parseInt(data.maxPlayers),
        questionAnswered: data.questionAnswered === 'true',
        createdAt: parseInt(data.createdAt),
        players: JSON.parse(data.players),
        questions: JSON.parse(data.questions),
        health: JSON.parse(data.health),
        readyPlayers: new Set(JSON.parse(data.readyPlayers || '[]')),
        eliminatedPlayers: new Set(JSON.parse(data.eliminatedPlayers || '[]'))
      };
    } catch (error) {
      console.error(`❌ Error getting survival room ${roomId}:`, error);
      return null;
    }
  }

  async deleteSurvivalRoom(roomId) {
    try {
      const key = `survival:${roomId}`;
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting survival room ${roomId}:`, error);
      return false;
    }
  }

  async getAllSurvivalRoomIds() {
    try {
      const keys = await this.client.keys('survival:*');
      return keys.map(key => key.replace('survival:', ''));
    } catch (error) {
      console.error('❌ Error getting all survival room IDs:', error);
      return [];
    }
  }

  // ===== PLAYER OPERATIONS =====

  async savePlayerInfo(playerId, playerData) {
    try {
      const key = `player:${playerId}`;
      await this.client.hSet(key, {
        id: playerId,
        connectedAt: playerData.connectedAt.toString(),
        currentRoom: playerData.currentRoom || '',
        roomType: playerData.roomType || ''
      });

      await this.client.expire(key, 3600);
      return true;
    } catch (error) {
      console.error(`❌ Error saving player ${playerId}:`, error);
      return false;
    }
  }

  async getPlayerInfo(playerId) {
    try {
      const key = `player:${playerId}`;
      const data = await this.client.hGetAll(key);

      if (!data || Object.keys(data).length === 0) {
        return null;
      }

      return {
        id: data.id,
        connectedAt: parseInt(data.connectedAt),
        currentRoom: data.currentRoom || null,
        roomType: data.roomType || null
      };
    } catch (error) {
      console.error(`❌ Error getting player ${playerId}:`, error);
      return null;
    }
  }

  async deletePlayer(playerId) {
    try {
      const key = `player:${playerId}`;
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting player ${playerId}:`, error);
      return false;
    }
  }

  // ===== UTILITY OPERATIONS =====

  async getAllKeys(pattern = '*') {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error('❌ Error getting all keys:', error);
      return [];
    }
  }

  async flushAll() {
    try {
      await this.client.flushAll();
      console.log('🗑️ Flushed all Redis data');
      return true;
    } catch (error) {
      console.error('❌ Error flushing Redis:', error);
      return false;
    }
  }
}

module.exports = RedisService;
