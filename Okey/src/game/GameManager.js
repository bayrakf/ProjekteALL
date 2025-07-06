const OkeyGame = require('./OkeyGame');
const { v4: uuidv4 } = require('uuid');

class GameManager {
    constructor(io) {
        this.io = io;
        this.rooms = new Map();
        this.userRooms = new Map(); // Maps socketId to roomId
        
        // Initialize default rooms
        this.initializeRooms();
        
        console.log('🎮 GameManager initialized');
    }
    
    initializeRooms() {
        // Okey rooms mit festen IDs für Frontend-Kompatibilität
        this.createRoom('okey', 'Anfänger Salon', 250, 0, 'room1');
        this.createRoom('okey', 'Fortgeschrittene', 250, 100, 'room2');
        this.createRoom('okey', 'Experten Salon', 250, 500, 'room3');
        
        console.log('🏠 Default rooms created with fixed IDs');
    }
    
    createRoom(type, name, maxPlayers, minScore, customId = null) {
        const roomId = customId || uuidv4();
        const room = {
            id: roomId,
            name: name,
            type: type, // 'okey' or 'batak'
            maxPlayers: maxPlayers,
            minScore: minScore,
            players: new Map(),
            spectators: new Map(),
            tables: new Map(), // Each table can have 4 players
            waitingPlayers: [],
            createdAt: new Date()
        };
        
        this.rooms.set(roomId, room);
        console.log(`🏠 Room created: ${name} (${roomId})`);
        return room;
    }
    
    joinRoom(socket, user, roomType, roomId = null) {
        // Find room by type if no specific roomId
        if (!roomId) {
            for (const [id, room] of this.rooms) {
                if (room.type === roomType && room.players.size < room.maxPlayers) {
                    roomId = id;
                    break;
                }
            }
        }
        
        const room = this.rooms.get(roomId);
        if (!room) {
            return { success: false, error: 'Room not found' };
        }
        
        // Check if user meets minimum score requirement
        if (user.score < room.minScore) {
            return { success: false, error: `Minimum ${room.minScore} points required` };
        }
        
        // Check room capacity
        if (room.players.size >= room.maxPlayers) {
            return { success: false, error: 'Room is full' };
        }
        
        // Remove user from previous room
        this.leaveRoom(socket.id);
        
        // Add user to room
        room.players.set(socket.id, user);
        this.userRooms.set(socket.id, roomId);
        
        // Join socket room
        socket.join(roomId);
        
        // Try to add to a game table
        this.assignPlayerToTable(room, socket.id, user);
        
        // Notify room about new player
        this.io.to(roomId).emit('player-joined', {
            user: user,
            roomInfo: this.getRoomInfo(room)
        });
        
        return { success: true, room: this.getRoomInfo(room) };
    }
    
    leaveRoom(socketId) {
        const roomId = this.userRooms.get(socketId);
        if (!roomId) return;
        
        const room = this.rooms.get(roomId);
        if (!room) return;
        
        // Remove from room
        room.players.delete(socketId);
        room.spectators.delete(socketId);
        
        // Remove from any game table
        for (const [tableId, table] of room.tables) {
            if (table.players.some(p => p.socketId === socketId)) {
                this.removePlayerFromTable(room, tableId, socketId);
                break;
            }
        }
        
        // Remove from waiting list
        room.waitingPlayers = room.waitingPlayers.filter(p => p.socketId !== socketId);
        
        this.userRooms.delete(socketId);
        
        // Notify room
        this.io.to(roomId).emit('player-left', {
            socketId: socketId,
            roomInfo: this.getRoomInfo(room)
        });
    }
    
    assignPlayerToTable(room, socketId, user) {
        // Look for existing table with space
        for (const [tableId, table] of room.tables) {
            if (table.players.length < 4 && table.status === 'waiting') {
                table.players.push({
                    socketId: socketId,
                    user: user,
                    ready: false
                });
                
                // Start game if 4 players
                if (table.players.length === 4) {
                    this.startGame(room, tableId);
                }
                
                this.io.to(room.id).emit('table-update', {
                    tableId: tableId,
                    table: this.getTableInfo(table)
                });
                
                return;
            }
        }
        
        // Create new table if no space
        const tableId = uuidv4();
        const table = {
            id: tableId,
            players: [{
                socketId: socketId,
                user: user,
                ready: false
            }],
            game: null,
            status: 'waiting', // 'waiting', 'playing', 'finished'
            createdAt: new Date()
        };
        
        room.tables.set(tableId, table);
        
        this.io.to(room.id).emit('table-created', {
            tableId: tableId,
            table: this.getTableInfo(table)
        });
    }
    
    removePlayerFromTable(room, tableId, socketId) {
        const table = room.tables.get(tableId);
        if (!table) return;
        
        // Remove player
        table.players = table.players.filter(p => p.socketId !== socketId);
        
        // If game was running, end it
        if (table.game && table.status === 'playing') {
            table.game.handlePlayerDisconnect(socketId);
            table.status = 'finished';
        }
        
        // Remove empty table
        if (table.players.length === 0) {
            room.tables.delete(tableId);
            this.io.to(room.id).emit('table-removed', { tableId: tableId });
        } else {
            this.io.to(room.id).emit('table-update', {
                tableId: tableId,
                table: this.getTableInfo(table)
            });
        }
    }
    
    startGame(room, tableId) {
        const table = room.tables.get(tableId);
        if (!table || table.players.length !== 4) return;
        
        // Create new Okey game
        table.game = new OkeyGame(table.players, this.io, room.id);
        table.status = 'playing';
        
        // Start the game
        table.game.startGame();
        
        console.log(`🎮 Game started at table ${tableId} in room ${room.name}`);
    }
    
    handleGameAction(socket, user, data) {
        const roomId = this.userRooms.get(socket.id);
        if (!roomId) return;
        
        const room = this.rooms.get(roomId);
        if (!room) return;
        
        // Find player's table
        for (const [tableId, table] of room.tables) {
            if (table.game && table.players.some(p => p.socketId === socket.id)) {
                table.game.handlePlayerAction(socket.id, data);
                break;
            }
        }
    }
    
    handleDisconnect(socketId) {
        this.leaveRoom(socketId);
    }
    
    getUserRoom(socketId) {
        const roomId = this.userRooms.get(socketId);
        return roomId ? this.rooms.get(roomId) : null;
    }
    
    getRoomsInfo() {
        const roomsInfo = [];
        
        for (const [id, room] of this.rooms) {
            // Get tables info with real player data
            const tables = [];
            
            // Add existing tables with players
            for (const [tableId, table] of room.tables) {
                tables.push({
                    id: tableId,
                    players: Array.from(table.players.values()).map(p => ({
                        name: p.username,
                        id: p.id,
                        score: p.score
                    }))
                });
            }
            
            // Add empty tables if we have less than 4 tables
            const tableCount = Math.max(4, tables.length);
            for (let i = tables.length; i < tableCount; i++) {
                tables.push({
                    id: `table${i + 1}`,
                    players: []
                });
            }
            
            roomsInfo.push({
                id: id,
                name: room.name,
                type: room.type,
                playerCount: room.players.size,
                maxPlayers: room.maxPlayers,
                minScore: room.minScore,
                tableCount: room.tables.size,
                tables: tables
            });
        }
        
        return roomsInfo;
    }
    
    getRoomInfo(room) {
        const tables = [];
        for (const [tableId, table] of room.tables) {
            tables.push({
                id: tableId,
                ...this.getTableInfo(table)
            });
        }
        
        return {
            id: room.id,
            name: room.name,
            type: room.type,
            playerCount: room.players.size,
            maxPlayers: room.maxPlayers,
            minScore: room.minScore,
            tables: tables,
            waitingCount: room.waitingPlayers.length
        };
    }
    
    getTableInfo(table) {
        return {
            players: table.players.map(p => ({
                username: p.user.username,
                score: p.user.score,
                ready: p.ready,
                isGuest: p.user.isGuest
            })),
            status: table.status,
            gameInfo: table.game ? table.game.getGameInfo() : null
        };
    }
    
    joinTable(socket, data) {
        console.log('🪑 GameManager joinTable called with:', data);
        
        const { roomId, tableId } = data;
        const user = socket.user || this.getUserFromSocket(socket);
        
        if (!user) {
            socket.emit('error', { message: 'User not found' });
            return { success: false, error: 'User not found' };
        }

        const room = this.rooms.get(roomId);
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return { success: false, error: 'Room not found' };
        }

        // Get or create table
        let table = room.tables.get(tableId);
        if (!table) {
            table = {
                id: tableId,
                players: [],
                game: null,
                status: 'waiting',
                createdAt: new Date()
            };
            room.tables.set(tableId, table);
        }

        // Check if table is full
        if (table.players.length >= 4) {
            socket.emit('error', { message: 'Table is full' });
            return { success: false, error: 'Table is full' };
        }

        // Remove user from previous table
        this.leaveRoom(socket.id);

        // Add user to room and table
        room.players.set(socket.id, user);
        this.userRooms.set(socket.id, roomId);

        table.players.push({
            socketId: socket.id,
            user: user,
            ready: false
        });

        // Join socket room
        socket.join(roomId);
        socket.join(`table_${tableId}`);

        // Notify player they joined
        socket.emit('joinedRoom', {
            success: true,
            roomId: roomId,
            tableId: tableId,
            tableInfo: this.getTableInfo(table)
        });

        // Notify other players
        socket.to(`table_${tableId}`).emit('playerJoined', {
            player: user,
            tableInfo: this.getTableInfo(table)
        });

        console.log(`✅ ${user.username} joined table ${tableId} in room ${roomId}`);

        // Start game if 4 players
        if (table.players.length === 4) {
            console.log('🎮 4 players reached, starting game...');
            this.startGame(room, tableId);
        }

        return { success: true, room: this.getRoomInfo(room) };
    }

    getUserFromSocket(socket) {
        // Try to get user from active users map (set by server)
        return socket.user || null;
    }

    leaveTable(socket, data) {
        const roomId = this.userRooms.get(socket.id);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (!room) return;

        // Find and remove from table
        for (const [tableId, table] of room.tables) {
            if (table.players.some(p => p.socketId === socket.id)) {
                this.removePlayerFromTable(room, tableId, socket.id);
                break;
            }
        }
    }
    
    broadcastRoomUpdate(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        
        // Create updated rooms list for lobby
        const roomsInfo = this.getRoomsInfo();
        
        // Broadcast to all clients not at a table
        this.io.emit('roomUpdate', {
            rooms: roomsInfo
        });
    }
    
    handleChatMessage(socket, data) {
        const { tableId, message, userId, username } = data;
        
        if (!tableId || !message || !username) {
            socket.emit('error', { message: 'Unvollständige Chat-Nachricht' });
            return;
        }
        
        console.log(`💬 Chat message from ${username} at table ${tableId}: ${message}`);
        
        // Broadcast to all players at the table
        const chatData = {
            username: username,
            message: message,
            timestamp: new Date(),
            userId: userId
        };
        
        this.io.to(`table_${tableId}`).emit('chatMessage', chatData);
    }
}

module.exports = GameManager;
