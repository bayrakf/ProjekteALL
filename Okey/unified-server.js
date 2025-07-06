const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const DatabaseManager = require('./src/DatabaseManager');
const AuthManager = require('./src/AuthManager');
const GameManager = require('./src/game/GameManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Admin Panel Route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-panel', 'admin.html'));
});

// Globale Manager
const dbManager = new DatabaseManager('./unified.sqlite');
const authManager = new AuthManager(dbManager);
const gameManager = new GameManager();

// Admin-Daten in Memory (für Demo - in Produktion: eigene DB-Tabelle)
let adminUsers = [
    { username: 'admin', password: 'admin123', role: 'super_admin' }
];

let gameRooms = new Map(); // roomId -> { name, maxPlayers, isActive, currentPlayers, gameSettings }

// Initialize database (optional - system works without it)
console.log('📊 System ready - using in-memory storage');

// Admin Authentication Middleware
function adminAuth(req, res, next) {
    const token = req.headers.authorization;
    if (!token || !token.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const username = token.replace('Bearer ', '');
    const admin = adminUsers.find(a => a.username === username);
    
    if (!admin) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
    }
    
    req.admin = admin;
    next();
}

// Routes

// Main page - zeigt verfügbare Spiele
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin Login
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    const admin = adminUsers.find(a => a.username === username && a.password === password);
    
    if (admin) {
        res.json({ 
            success: true, 
            token: admin.username,
            role: admin.role 
        });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Admin: Get all rooms
app.get('/api/admin/rooms', adminAuth, (req, res) => {
    const rooms = Array.from(gameRooms.entries()).map(([id, room]) => {
        const gameRoom = gameManager.rooms.get(id);
        const currentPlayers = gameRoom?.tables?.get('table1')?.players?.length || 0;
        const gameActive = gameRoom?.tables?.get('table1')?.game?.gameState !== 'waiting';
        
        return {
            id,
            ...room,
            currentPlayers,
            gameActive
        };
    });
    
    res.json(rooms);
});

// Admin: Create new room
app.post('/api/admin/rooms', adminAuth, (req, res) => {
    const { name, maxPlayers = 4, gameSettings = {} } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: 'Room name required' });
    }
    
    const roomId = 'room_' + Date.now();
    
    gameRooms.set(roomId, {
        name,
        maxPlayers,
        isActive: true,
        createdAt: new Date(),
        gameSettings
    });
    
    res.json({ 
        success: true, 
        roomId,
        message: `Room "${name}" created successfully` 
    });
});

// Admin: Delete room
app.delete('/api/admin/rooms/:roomId', adminAuth, (req, res) => {
    const { roomId } = req.params;
    
    if (gameRooms.has(roomId)) {
        // Kick all players from the room
        const gameRoom = gameManager.rooms.get(roomId);
        if (gameRoom && gameRoom.tables) {
            const table = gameRoom.tables.get('table1');
            if (table && table.players) {
                table.players.forEach(player => {
                    if (player.socket) {
                        player.socket.emit('room_closed', { reason: 'Room deleted by admin' });
                        player.socket.leave(roomId);
                    }
                });
            }
        }
        
        // Remove from GameManager and local storage
        gameManager.rooms.delete(roomId);
        gameRooms.delete(roomId);
        
        res.json({ success: true, message: 'Room deleted successfully' });
    } else {
        res.status(404).json({ error: 'Room not found' });
    }
});

// Admin: Get statistics
app.get('/api/admin/stats', adminAuth, (req, res) => {
    const totalRooms = gameRooms.size;
    const activeGames = Array.from(gameRooms.keys())
        .filter(roomId => {
            const gameRoom = gameManager.rooms.get(roomId);
            return gameRoom?.tables?.get('table1')?.game?.gameState !== 'waiting';
        }).length;
    
    const totalPlayers = Array.from(gameRooms.keys())
        .reduce((sum, roomId) => {
            const gameRoom = gameManager.rooms.get(roomId);
            return sum + (gameRoom?.tables?.get('table1')?.players?.length || 0);
        }, 0);
    
    res.json({
        totalRooms,
        activeGames,
        totalPlayers,
        serverUptime: process.uptime()
    });
});

// Player: Get available rooms
app.get('/api/rooms', (req, res) => {
    const availableRooms = Array.from(gameRooms.entries())
        .filter(([id, room]) => room.isActive)
        .map(([id, room]) => {
            const gameRoom = gameManager.rooms.get(id);
            const currentPlayers = gameRoom?.tables?.get('table1')?.players?.length || 0;
            return {
                id,
                name: room.name,
                currentPlayers,
                maxPlayers: room.maxPlayers,
                canJoin: currentPlayers < room.maxPlayers
            };
        });
    
    res.json(availableRooms);
});

// Socket.IO handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('guest_login', (data) => {
        const { username } = data;
        if (!username || username.trim() === '') {
            socket.emit('login_error', { message: 'Username required' });
            return;
        }
        
        socket.username = username.trim();
        socket.isGuest = true;
        socket.emit('login_success', { 
            username: socket.username,
            isGuest: true 
        });
        
        console.log(`Guest login: ${socket.username}`);
    });
    
    socket.on('join_room', (data) => {
        const { roomId } = data;
        
        if (!socket.username) {
            socket.emit('error', { message: 'Please login first' });
            return;
        }
        
        if (!gameRooms.has(roomId)) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        
        const roomConfig = gameRooms.get(roomId);
        
        if (!roomConfig.isActive) {
            socket.emit('error', { message: 'Room is not active' });
            return;
        }
        
        // Create room in GameManager if it doesn't exist
        if (!gameManager.rooms.has(roomId)) {
            gameManager.createRoom('okey', roomConfig.name, roomConfig.maxPlayers, 0, roomId);
        }
        
        // Prepare user object for GameManager
        const user = {
            id: socket.id,
            username: socket.username,
            socket: socket,
            score: 0 // Default score for guests
        };
        
        // Join room through GameManager with correct parameters
        try {
            const result = gameManager.joinRoom(socket, user, 'okey', roomId);
            
            if (result.success) {
                socket.currentRoom = roomId;
                
                const gameRoom = gameManager.rooms.get(roomId);
                const playersCount = gameRoom ? gameRoom.players.size : 1;
                
                socket.emit('room_joined', {
                    roomId,
                    roomName: roomConfig.name,
                    playersCount,
                    success: true
                });
                
                // Update other players
                socket.to(roomId).emit('player_joined', {
                    username: socket.username,
                    playersCount
                });
                
                console.log(`${socket.username} joined room ${roomId} (${playersCount} players)`);
            } else {
                socket.emit('error', { message: result.error || 'Failed to join room' });
            }
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    });
    
    socket.on('leave_room', () => {
        if (socket.currentRoom) {
            const gameRoom = gameManager.rooms.get(socket.currentRoom);
            if (gameRoom) {
                gameManager.leaveRoom(socket.currentRoom, socket.id);
            }
            socket.leave(socket.currentRoom);
            socket.to(socket.currentRoom).emit('player_left', {
                username: socket.username
            });
            socket.currentRoom = null;
        }
    });
    
    // Game events
    socket.on('start_game', () => {
        if (!socket.currentRoom) return;
        
        try {
            const result = gameManager.startGame(socket.currentRoom);
            if (result.success) {
                io.to(socket.currentRoom).emit('game_started', result.gameState);
            } else {
                socket.emit('error', { message: result.message });
            }
        } catch (error) {
            console.error('Error starting game:', error);
            socket.emit('error', { message: 'Failed to start game' });
        }
    });
    
    socket.on('make_move', (data) => {
        if (!socket.currentRoom) return;
        
        try {
            const result = gameManager.makeMove(socket.currentRoom, socket.id, data);
            if (result.success) {
                io.to(socket.currentRoom).emit('game_update', result.gameState);
                
                if (result.gameState.winner) {
                    io.to(socket.currentRoom).emit('game_ended', {
                        winner: result.gameState.winner,
                        gameState: result.gameState
                    });
                }
            } else {
                socket.emit('error', { message: result.message });
            }
        } catch (error) {
            console.error('Error making move:', error);
            socket.emit('error', { message: 'Invalid move' });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        if (socket.currentRoom) {
            const gameRoom = gameManager.rooms.get(socket.currentRoom);
            if (gameRoom) {
                gameManager.leaveRoom(socket.currentRoom, socket.id);
            }
            socket.to(socket.currentRoom).emit('player_left', {
                username: socket.username
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎮 Okey Game Server running on http://localhost:${PORT}`);
    console.log(`📊 Admin Panel: http://localhost:${PORT}/admin`);
    console.log(`🎯 Game: http://localhost:${PORT}`);
});
