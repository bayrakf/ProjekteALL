const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

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

// Einfache In-Memory Datenstrukturen
let adminUsers = [
    { username: 'admin', password: 'admin123', role: 'super_admin' }
];

let gameRooms = new Map(); // roomId -> { name, maxPlayers, players: Map() }
let connectedUsers = new Map(); // socketId -> { username, currentRoom }

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

// Main page
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
    const rooms = Array.from(gameRooms.entries()).map(([id, room]) => ({
        id,
        name: room.name,
        maxPlayers: room.maxPlayers,
        currentPlayers: room.players.size,
        isActive: true,
        createdAt: room.createdAt,
        gameActive: room.gameStarted || false
    }));
    
    res.json(rooms);
});

// Admin: Create new room
app.post('/api/admin/rooms', adminAuth, (req, res) => {
    const { name, maxPlayers = 4 } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: 'Room name required' });
    }
    
    const roomId = 'room_' + Date.now();
    
    gameRooms.set(roomId, {
        name,
        maxPlayers,
        players: new Map(),
        createdAt: new Date(),
        gameStarted: false,
        gameState: null
    });
    
    console.log(`🏠 Admin created room: ${name} (${roomId})`);
    
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
        const room = gameRooms.get(roomId);
        
        // Kick all players from the room
        room.players.forEach((player, socketId) => {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                socket.emit('room_closed', { reason: 'Room deleted by admin' });
                socket.leave(roomId);
            }
        });
        
        gameRooms.delete(roomId);
        
        console.log(`🗑️ Admin deleted room: ${roomId}`);
        
        res.json({ success: true, message: 'Room deleted successfully' });
    } else {
        res.status(404).json({ error: 'Room not found' });
    }
});

// Admin: Get statistics
app.get('/api/admin/stats', adminAuth, (req, res) => {
    const totalRooms = gameRooms.size;
    const totalPlayers = connectedUsers.size;
    const activeGames = Array.from(gameRooms.values()).filter(room => room.gameStarted).length;
    
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
        .map(([id, room]) => ({
            id,
            name: room.name,
            currentPlayers: room.players.size,
            maxPlayers: room.maxPlayers,
            canJoin: room.players.size < room.maxPlayers && !room.gameStarted
        }));
    
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
        
        connectedUsers.set(socket.id, {
            username: socket.username,
            currentRoom: null
        });
        
        socket.emit('login_success', { 
            username: socket.username,
            isGuest: true 
        });
        
        console.log(`Guest login: ${socket.username} (${socket.id})`);
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
        
        const room = gameRooms.get(roomId);
        
        if (room.players.size >= room.maxPlayers) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }
        
        if (room.gameStarted) {
            socket.emit('error', { message: 'Game already started' });
            return;
        }
        
        // Leave previous room if any
        if (socket.currentRoom) {
            const prevRoom = gameRooms.get(socket.currentRoom);
            if (prevRoom) {
                prevRoom.players.delete(socket.id);
                socket.leave(socket.currentRoom);
                socket.to(socket.currentRoom).emit('player_left', {
                    username: socket.username,
                    playersCount: prevRoom.players.size
                });
            }
        }
        
        // Join new room
        room.players.set(socket.id, {
            username: socket.username,
            socket: socket
        });
        
        socket.join(roomId);
        socket.currentRoom = roomId;
        
        const user = connectedUsers.get(socket.id);
        if (user) {
            user.currentRoom = roomId;
        }
        
        socket.emit('room_joined', {
            roomId,
            roomName: room.name,
            playersCount: room.players.size,
            success: true
        });
        
        // Update other players
        socket.to(roomId).emit('player_joined', {
            username: socket.username,
            playersCount: room.players.size
        });
        
        console.log(`${socket.username} joined room ${room.name} (${room.players.size}/${room.maxPlayers})`);
        
        // Auto-start game wenn der Raum voll ist (4 Spieler)
        if (room.players.size === room.maxPlayers && !room.gameStarted) {
            console.log(`🎮 Auto-starting game in room ${room.name} with ${room.players.size} players`);
            
            // Markiere Spiel als gestartet
            room.gameStarted = true;
            room.gameState = 'playing';
            
            // Sende game_started Event an alle Spieler im Raum
            io.to(roomId).emit('game_started', {
                roomId: roomId,
                roomName: room.name,
                playersCount: room.players.size,
                message: 'Das Spiel beginnt automatisch!'
            });
            
            console.log(`🎮 Game started in room ${room.name} with ${room.players.size} players`);
        }
    });
    
    socket.on('leave_room', () => {
        if (socket.currentRoom) {
            const room = gameRooms.get(socket.currentRoom);
            if (room) {
                room.players.delete(socket.id);
                socket.to(socket.currentRoom).emit('player_left', {
                    username: socket.username,
                    playersCount: room.players.size
                });
            }
            
            socket.leave(socket.currentRoom);
            socket.currentRoom = null;
            
            const user = connectedUsers.get(socket.id);
            if (user) {
                user.currentRoom = null;
            }
        }
    });
    
    socket.on('start_game', () => {
        if (!socket.currentRoom) {
            socket.emit('error', { message: 'Not in a room' });
            return;
        }
        
        const room = gameRooms.get(socket.currentRoom);
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        
        if (room.players.size < 2) {
            socket.emit('error', { message: 'Need at least 2 players to start' });
            return;
        }
        
        if (room.gameStarted) {
            socket.emit('error', { message: 'Game already started' });
            return;
        }
        
        // Start game
        room.gameStarted = true;
        room.gameState = {
            players: Array.from(room.players.values()).map(p => p.username),
            currentPlayer: 0,
            round: 1,
            status: 'playing'
        };
        
        io.to(socket.currentRoom).emit('game_started', {
            gameState: room.gameState,
            message: 'Game started!'
        });
        
        console.log(`🎮 Game started in room ${room.name} with ${room.players.size} players`);
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Remove from room
        if (socket.currentRoom) {
            const room = gameRooms.get(socket.currentRoom);
            if (room) {
                room.players.delete(socket.id);
                socket.to(socket.currentRoom).emit('player_left', {
                    username: socket.username,
                    playersCount: room.players.size
                });
            }
        }
        
        // Remove from connected users
        connectedUsers.delete(socket.id);
    });
});

console.log('📊 System ready - using in-memory storage');

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎮 Stable Okey Game Server running on http://localhost:${PORT}`);
    console.log(`📊 Admin Panel: http://localhost:${PORT}/admin`);
    console.log(`🎯 Game: http://localhost:${PORT}`);
});
