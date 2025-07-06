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
                
                // Join socket to table room for game events
                const socket = this.io.sockets.sockets.get(socketId);
                if (socket) {
                    socket.join(tableId);
                    console.log(`🪑 Player ${user.username} joined table room: ${tableId}`);
                }
                
                // Start game if 4 players
                if (table.players.length === 4) {
                    this.startGame(room, tableId);
                }
                
                this.io.to(room.id).emit('table-update', {
                    tableId: tableId,
                    table: this.getTableInfo(table)
                });
                
                return {
                    success: true,
                    tableId: tableId,
                    table: this.getTableInfo(table)
                };
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
        
        // Join socket to table room for game events
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
            socket.join(tableId);
            console.log(`🪑 Player ${user.username} created and joined table room: ${tableId}`);
        }
        
        this.io.to(room.id).emit('table-created', {
            tableId: tableId,
            table: this.getTableInfo(table)
        });
        
        return {
            success: true,
            tableId: tableId,
            table: this.getTableInfo(table)
        };
    }
    
    removePlayerFromTable(room, tableId, socketId) {
        const table = room.tables.get(tableId);
        if (!table) return;
        
        // Remove player
        table.players = table.players.filter(p => p.socketId !== socketId);
        
        // If game was running, end it
        if (table.game && table.status === 'playing') {
            // Handle player disconnect in game
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
        
        // Prepare players array for OkeyGame
        const gamePlayers = table.players.map(p => ({
            id: p.user.id,
            username: p.user.username,
            socketId: p.socketId,
            score: p.user.score || 0
        }));
        
        // Create new Okey game with correct parameters
        table.game = new OkeyGame(tableId, gamePlayers, this.io);
        table.status = 'playing';
        
        // Start the game
        try {
            table.game.startGame();
            console.log(`🎮 Okey game started at table ${tableId} in room ${room.name}`);
            
            // Notify players that game started
            for (const player of table.players) {
                this.io.to(player.socketId).emit('joinedRoom', {
                    success: true,
                    roomId: room.id,
                    tableId: tableId,
                    tableInfo: this.getTableInfo(table)
                });
            }
        } catch (error) {
            console.error(`❌ Failed to start game at table ${tableId}:`, error);
            table.status = 'waiting';
        }
    }
    
    handleGameAction(socket, user, data) {
        const roomId = this.userRooms.get(socket.id);
        if (!roomId) {
            socket.emit('error', { message: 'Not in a room' });
            return;
        }
        
        const room = this.rooms.get(roomId);
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        
        // Find player's table
        for (const [tableId, table] of room.tables) {
            if (table.game && table.players.some(p => p.socketId === socket.id)) {
                const game = table.game;
                
                switch (data.action) {
                    case 'drawTile':
                        const drawResult = game.drawTile(user.id);
                        if (!drawResult.success) {
                            socket.emit('error', { message: drawResult.error });
                        }
                        break;
                        
                    case 'discardTile':
                        const discardResult = game.discardTile(user.id, data.tileId);
                        if (!discardResult.success) {
                            socket.emit('error', { message: discardResult.error });
                        }
                        break;
                        
                    case 'declareWin':
                        // Check if player actually has a winning hand
                        if (game.checkWinCondition(user.id)) {
                            game.endGame(user.id);
                        } else {
                            socket.emit('error', { message: 'Invalid win declaration' });
                        }
                        break;
                        
                    default:
                        socket.emit('error', { message: 'Unknown game action' });
                }
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
    
    getUserTable(socketId) {
        const room = this.getUserRoom(socketId);
        if (!room) return null;
        
        // Find the table containing this player
        for (const [tableId, table] of room.tables) {
            if (table.players.some(p => p.socketId === socketId)) {
                return table;
            }
        }
        return null;
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
                    players: table.players.map(p => ({
                        name: p.user.username,
                        id: p.user.id,
                        score: p.user.score
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
                socketId: p.socketId,
                username: p.user.username,
                score: p.user.score,
                ready: p.ready
            })),
            status: table.status,
            gameInfo: table.game ? table.game.getGameInfo() : null
        };
    }
}

module.exports = GameManager;