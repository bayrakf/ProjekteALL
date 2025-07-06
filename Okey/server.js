const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const GameManager = require('./src/game/GameManager');
const AuthManager = require('./src/AuthManager');
const DatabaseManager = require('./src/DatabaseManager');

class OkeyServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.gameManager = new GameManager(this.io);
        this.authManager = new AuthManager();
        this.dbManager = new DatabaseManager();
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
        
        this.activeUsers = new Map();
        this.guestCounter = 1000;
        
        console.log('🎮 Okey Nostalji Server initializing...');
    }
    
    setupMiddleware() {
        // Security
        this.app.use(helmet({
            contentSecurityPolicy: false // Allow inline scripts for game
        }));
        
        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100 // limit each IP to 100 requests per windowMs
        });
        this.app.use('/api', limiter);
        
        // CORS
        this.app.use(cors());
        
        // Body parsing
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // Static files
        this.app.use(express.static(path.join(__dirname, 'public')));
    }
    
    setupRoutes() {
        // Main page
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });
        
        // API Routes
        this.app.post('/api/auth/register', async (req, res) => {
            try {
                const { username, email, password } = req.body;
                const result = await this.authManager.register(username, email, password);
                res.json(result);
            } catch (error) {
                res.status(400).json({ success: false, message: error.message });
            }
        });
        
        this.app.post('/api/auth/login', async (req, res) => {
            try {
                const { username, password } = req.body;
                const result = await this.authManager.login(username, password);
                res.json(result);
            } catch (error) {
                res.status(401).json({ success: false, message: error.message });
            }
        });

        this.app.post('/api/auth/guest', async (req, res) => {
            try {
                const { guestName } = req.body;
                const result = await this.authManager.createGuestUser(guestName);
                res.json(result);
            } catch (error) {
                res.status(400).json({ success: false, message: error.message });
            }
        });
        
        this.app.get('/api/leaderboard', async (req, res) => {
            try {
                const leaderboard = await this.dbManager.getLeaderboard();
                res.json(leaderboard);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        this.app.get('/api/rooms', (req, res) => {
            try {
                // Get real rooms data from GameManager
                const roomsInfo = this.gameManager.getRoomsInfo();
                
                console.log('📡 Sending rooms data:', JSON.stringify(roomsInfo, null, 2));
                res.json({ success: true, rooms: roomsInfo });
            } catch (error) {
                console.error('❌ Error getting rooms:', error);
                // Fallback to mock data
                const mockRooms = [
                    {
                        id: 'room1',
                        name: 'Anfänger Salon',
                        playerCount: Array.from(this.activeUsers.values()).length,
                        maxPlayers: 50,
                        tables: [
                            { id: 'table1', players: [] },
                            { id: 'table2', players: [] },
                            { id: 'table3', players: [] },
                            { id: 'table4', players: [] }
                        ]
                    },
                    {
                        id: 'room2',
                        name: 'Fortgeschrittene',
                        playerCount: Math.floor(Array.from(this.activeUsers.values()).length / 2),
                        maxPlayers: 50,
                        tables: [
                            { id: 'table5', players: [] },
                            { id: 'table6', players: [] },
                            { id: 'table7', players: [] },
                            { id: 'table8', players: [] }
                        ]
                    }
                ];
                
                res.json({ success: true, rooms: mockRooms });
            }
        });
    }
    
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`👤 User connected: ${socket.id}`);
            
            // Modern authenticate event (from frontend)
            socket.on('authenticate', (data) => {
                console.log('🔐 Authentication attempt:', data);
                
                if (data.isGuest) {
                    // Guest authentication
                    const user = {
                        id: data.userId || socket.id,
                        username: data.username,
                        isGuest: true,
                        score: 0,
                        avatar: 'guest'
                    };
                    
                    this.activeUsers.set(socket.id, user);
                    socket.user = user; // Attach user to socket
                    socket.emit('authenticated', { success: true, user });
                    this.broadcastUserCount();
                    
                    console.log(`🎭 Guest authenticated: ${user.username}`);
                } else {
                    // Regular user authentication
                    if (data.token) {
                        this.authManager.verifyToken(data.token).then(user => {
                            if (user) {
                                user.id = socket.id;
                                this.activeUsers.set(socket.id, user);
                                socket.user = user; // Attach user to socket
                                socket.emit('authenticated', { success: true, user });
                                this.broadcastUserCount();
                                
                                console.log(`✅ User authenticated: ${user.username}`);
                            } else {
                                socket.emit('authenticated', { success: false, message: 'Invalid token' });
                            }
                        }).catch(error => {
                            socket.emit('authenticated', { success: false, message: 'Authentication failed' });
                        });
                    } else {
                        socket.emit('authenticated', { success: false, message: 'No token provided' });
                    }
                }
            });

            // Legacy events for backward compatibility
            socket.on('guest-login', (data) => {
                const guestName = data.guestName || `Misafir${this.guestCounter++}`;
                const user = {
                    id: socket.id,
                    username: guestName,
                    isGuest: true,
                    score: 1000,
                    avatar: 'guest'
                };
                
                this.activeUsers.set(socket.id, user);
                socket.user = user; // Attach user to socket
                socket.emit('authenticated', { success: true, user });
                this.broadcastUserCount();
                
                console.log(`🎭 Legacy guest authenticated: ${user.username}`);
            });
            
            // User login
            socket.on('user-login', async (data) => {
                try {
                    const { token } = data;
                    const user = await this.authManager.verifyToken(token);
                    
                    if (user) {
                        user.id = socket.id;
                        this.activeUsers.set(socket.id, user);
                        socket.emit('login-success', user);
                        this.broadcastUserCount();
                        
                        console.log(`✅ User logged in: ${user.username}`);
                    } else {
                        socket.emit('login-error', { message: 'Invalid token' });
                    }
                } catch (error) {
                    socket.emit('login-error', { message: error.message });
                }
            });
            
            // Join room
            socket.on('join-room', (data) => {
                const user = this.activeUsers.get(socket.id);
                if (!user) {
                    socket.emit('error', { message: 'User not logged in' });
                    return;
                }
                
                const { roomType, roomId } = data;
                const result = this.gameManager.joinRoom(socket, user, roomType, roomId);
                
                if (result.success) {
                    socket.emit('room-joined', result.room);
                    this.broadcastRoomUpdate();
                } else {
                    socket.emit('error', { message: result.error });
                }
            });
            
            // Enhanced socket events for multiplayer
            socket.on('joinTable', (data) => {
                console.log('🪑 joinTable event received:', data);
                console.log('🤔 Current user:', this.activeUsers.get(socket.id));
                
                try {
                    const result = this.gameManager.joinTable(socket, data);
                    console.log('✅ joinTable result:', result ? 'success' : 'failed');
                } catch (error) {
                    console.error('❌ joinTable error:', error);
                    socket.emit('error', { message: 'Fehler beim Tisch beitreten: ' + error.message });
                }
            });
            
            socket.on('leaveTable', (data) => {
                console.log('🚪 leaveTable event received:', data);
                this.gameManager.leaveTable(socket, data);
            });
            
            socket.on('chatMessage', (data) => {
                console.log('💬 chatMessage event received:', data);
                this.gameManager.handleChatMessage(socket, data);
            });
            
            socket.on('startGame', (data) => {
                console.log('🎮 startGame event received:', data);
                const { tableId } = data;
                const user = this.activeUsers.get(socket.id);
                
                // Generate authentic Okey game data
                const gameData = this.generateOkeyGameData(tableId);
                
                this.io.to(`table_${tableId}`).emit('gameStarted', {
                    message: 'Spiel gestartet!',
                    gameState: gameData.gameState,
                    playerHands: gameData.playerHands,
                    okeyTile: gameData.okeyTile,
                    indicatorTile: gameData.indicatorTile,
                    currentPlayer: gameData.gameState.currentPlayer,
                    scores: gameData.scores
                });
            });
            
            socket.on('drawTile', (data) => {
                console.log('🎲 drawTile event received:', data);
                // TODO: Implement real tile drawing logic
                const { tableId, userId } = data;
                const mockTile = {
                    id: `tile_${Date.now()}`,
                    number: Math.floor(Math.random() * 13) + 1,
                    color: ['red', 'black', 'blue', 'green'][Math.floor(Math.random() * 4)],
                    isOkey: false
                };
                
                this.io.to(`table_${tableId}`).emit('tileDrawn', {
                    userId: userId,
                    tile: mockTile,
                    gameState: {
                        currentPlayer: userId,
                        round: 1,
                        tilesLeft: 105
                    }
                });
            });
            
            socket.on('discardTile', (data) => {
                console.log('🗑️ discardTile event received:', data);
                const { tableId, userId, tile } = data;
                
                this.io.to(`table_${tableId}`).emit('tileDiscarded', {
                    userId: userId,
                    tile: tile,
                    username: this.activeUsers.get(socket.id)?.username || 'Unknown',
                    gameState: {
                        currentPlayer: userId,
                        round: 1,
                        tilesLeft: 106
                    }
                });
            });
            
            socket.on('finishTurn', (data) => {
                console.log('✅ finishTurn event received:', data);
                const { tableId, userId } = data;
                
                // Mock: Switch to next player
                this.io.to(`table_${tableId}`).emit('turnChanged', {
                    gameState: {
                        currentPlayer: 'next_player_id', // TODO: Implement proper turn logic
                        round: 1,
                        tilesLeft: 106
                    },
                    currentPlayerName: 'Nächster Spieler'
                });
            });
            
            socket.on('declareWin', (data) => {
                console.log('🏆 declareWin event received:', data);
                const { tableId, userId, hand } = data;
                const user = this.activeUsers.get(socket.id);
                
                this.io.to(`table_${tableId}`).emit('gameEnded', {
                    winner: user?.username || 'Unknown',
                    reason: 'okey',
                    scores: { [userId]: 100 } // Mock scoring
                });
            });

            // Complete Socket Events for Okey Game
            socket.on('getRooms', () => {
                console.log('🏠 getRooms event received');
                const roomsInfo = this.gameManager.getRoomsInfo();
                socket.emit('rooms', roomsInfo);
            });

            socket.on('playerAction', (action) => {
                console.log('🎮 playerAction received:', action);
                const user = this.activeUsers.get(socket.id);
                if (user) {
                    this.gameManager.handleGameAction(socket, user, action);
                } else {
                    socket.emit('error', { message: 'User not authenticated' });
                }
            });

            socket.on('demoPlayerJoin', (demoPlayer) => {
                console.log('🤖 Demo player join:', demoPlayer);
                // Add demo player to active users for testing
                const demoSocketId = `demo_${demoPlayer.id}`;
                this.activeUsers.set(demoSocketId, demoPlayer);
                
                // Simulate demo player joining current room
                const userRoom = this.gameManager.getUserRoom(socket.id);
                if (userRoom) {
                    this.gameManager.joinRoom({ id: demoSocketId, join: () => {} }, demoPlayer, 'okey', userRoom.id);
                }
            });

            // Disconnect
            socket.on('disconnect', () => {
                console.log(`👋 User disconnected: ${socket.id}`);
                
                this.gameManager.handleDisconnect(socket.id);
                this.activeUsers.delete(socket.id);
                this.broadcastUserCount();
                this.broadcastRoomUpdate();
            });
        });
    }
    
    broadcastUserCount() {
        const userCount = this.activeUsers.size;
        this.io.emit('user-count-update', { count: userCount });
    }
    
    broadcastRoomUpdate() {
        const roomsInfo = this.gameManager.getRoomsInfo();
        this.io.emit('rooms-update', roomsInfo);
    }
    
    start() {
        const PORT = process.env.PORT || 3000;
        this.server.listen(PORT, () => {
            console.log(`🚀 Okey Nostalji Server running on port ${PORT}`);
            console.log(`🌐 Open http://localhost:${PORT} to play!`);
        });
    }
    
    generateOkeyGameData(tableId) {
        // Get players at table
        const table = this.gameManager.getTable(tableId);
        const players = table ? table.players : [];
        
        // Generate full Okey tile set
        const tiles = this.generateOkeyTileSet();
        
        // Shuffle tiles
        this.shuffleTiles(tiles);
        
        // Select indicator tile (gösterge)
        const indicatorTile = tiles.pop();
        
        // Calculate Okey tile based on indicator
        const okeyTile = this.calculateOkeyTile(indicatorTile);
        
        // Deal tiles to players (14 tiles each for 4 players)
        const playerHands = {};
        const playerIds = players.map(p => p.id);
        
        for (let i = 0; i < playerIds.length; i++) {
            playerHands[playerIds[i]] = tiles.splice(0, 14);
        }
        
        // First player gets an extra tile (15 total)
        if (playerIds.length > 0) {
            playerHands[playerIds[0]].push(tiles.pop());
        }
        
        return {
            gameState: {
                currentPlayer: playerIds[0] || null,
                round: 1,
                tilesLeft: tiles.length,
                turn: 1
            },
            playerHands,
            okeyTile,
            indicatorTile,
            scores: playerIds.reduce((acc, id) => ({ ...acc, [id]: 0 }), {})
        };
    }
    
    generateOkeyTileSet() {
        const tiles = [];
        const colors = ['red', 'black', 'blue', 'yellow'];
        
        // Generate numbered tiles (1-13 in each color, 2 sets)
        for (let set = 0; set < 2; set++) {
            for (let color of colors) {
                for (let number = 1; number <= 13; number++) {
                    tiles.push({
                        id: `${color}_${number}_${set}`,
                        number,
                        color,
                        isOkey: false,
                        isFakeOkey: false
                    });
                }
            }
        }
        
        // Add 2 fake okeys (jokers)
        tiles.push({
            id: 'fake_okey_1',
            number: 0,
            color: 'joker',
            isOkey: false,
            isFakeOkey: true
        });
        
        tiles.push({
            id: 'fake_okey_2',
            number: 0,
            color: 'joker',
            isOkey: false,
            isFakeOkey: true
        });
        
        return tiles;
    }
    
    shuffleTiles(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    
    calculateOkeyTile(indicatorTile) {
        if (indicatorTile.isFakeOkey) {
            return { number: 1, color: 'red', isOkey: true };
        }
        
        let okeyNumber = indicatorTile.number + 1;
        if (okeyNumber > 13) okeyNumber = 1;
        
        return {
            number: okeyNumber,
            color: indicatorTile.color,
            isOkey: true
        };
    }
}

// Initialize and start server
const server = new OkeyServer();
server.start();

module.exports = OkeyServer;
