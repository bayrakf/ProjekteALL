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
        // Tenant-specific configuration
        this.tenantId = process.env.TENANT_ID || null;
        this.maxPlayers = parseInt(process.env.MAX_PLAYERS) || 1000;
        this.dbPath = process.env.DB_PATH || './database.sqlite';
        this.port = process.env.PORT || 3000;
        
        if (this.tenantId) {
            console.log(`🎮 Starting as Tenant: ${this.tenantId}`);
            console.log(`👥 Max Players: ${this.maxPlayers}`);
            console.log(`💾 Database: ${this.dbPath}`);
        }
        
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
            // Check tenant player limits
            if (this.tenantId && this.maxPlayers) {
                const currentConnections = this.io.engine.clientsCount;
                if (currentConnections > this.maxPlayers) {
                    console.log(`❌ Tenant ${this.tenantId}: Player limit reached (${currentConnections}/${this.maxPlayers})`);
                    socket.emit('error', { 
                        message: `Server voll! Maximale Spieleranzahl (${this.maxPlayers}) erreicht.`,
                        code: 'TENANT_LIMIT_REACHED'
                    });
                    socket.disconnect();
                    return;
                }
            }
            
            console.log(`👤 User connected: ${socket.id}${this.tenantId ? ` [Tenant: ${this.tenantId}]` : ''}`);
            
            // Modern authenticate event (from frontend)
            socket.on('authenticate', (data) => {
                console.log('🔐 Authentication attempt:', data);
                
                if (data.isGuest) {
                    // Guest authentication
                    const user = {
                        id: data.userId || socket.id,
                        username: data.username,
                        isGuest: true,
                        score: 1000,  // Genügend Punkte für alle Räume
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
                    score: 1000,  // Genügend Punkte für alle Räume
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
            
            // Enhanced socket events for Okey game actions
            socket.on('joinTable', (data) => {
                console.log('🪑 joinTable event received:', data);
                const user = this.activeUsers.get(socket.id);
                
                if (!user) {
                    console.log('❌ User not authenticated for socket:', socket.id);
                    socket.emit('error', { message: 'User not authenticated' });
                    return;
                }
                
                console.log('👤 User attempting to join room:', user);
                
                try {
                    const result = this.gameManager.joinRoom(socket, user, 'okey', data.roomId);
                    console.log('🎯 joinRoom result:', result);
                    
                    if (result.success) {
                        console.log('✅ Successfully joined room');
                        socket.emit('joinedRoom', {
                            success: true,
                            roomId: data.roomId,
                            tableId: 'auto-assigned',
                            tableInfo: result.room
                        });
                    } else {
                        console.log('❌ Failed to join room:', result.error);
                        socket.emit('error', { message: result.error });
                    }
                } catch (error) {
                    console.error('❌ joinTable error:', error);
                    socket.emit('error', { message: 'Fehler beim Tisch beitreten: ' + error.message });
                }
            });
            
            socket.on('leaveTable', (data) => {
                console.log('🚪 leaveTable event received:', data);
                this.gameManager.leaveRoom(socket.id);
            });
            
            socket.on('chatMessage', (data) => {
                console.log('💬 chatMessage event received:', data);
                // Simple chat implementation
                const user = this.activeUsers.get(socket.id);
                if (user) {
                    const roomId = this.gameManager.userRooms.get(socket.id);
                    if (roomId) {
                        this.io.to(roomId).emit('chatMessage', {
                            username: user.username,
                            message: data.message,
                            timestamp: new Date()
                        });
                    }
                }
            });
            
            // Okey Game Actions
            socket.on('drawTile', (data) => {
                console.log('🎲 drawTile event received:', data);
                const user = this.activeUsers.get(socket.id);
                if (!user) {
                    socket.emit('error', { message: 'User not authenticated' });
                    return;
                }
                
                this.gameManager.handleGameAction(socket, user, {
                    action: 'drawTile',
                    ...data
                });
            });
            
            socket.on('discardTile', (data) => {
                console.log('🗑️ discardTile event received:', data);
                const user = this.activeUsers.get(socket.id);
                if (!user) {
                    socket.emit('error', { message: 'User not authenticated' });
                    return;
                }
                
                this.gameManager.handleGameAction(socket, user, {
                    action: 'discardTile',
                    ...data
                });
            });
            
            socket.on('declareWin', (data) => {
                console.log('🏆 declareWin event received:', data);
                const user = this.activeUsers.get(socket.id);
                if (!user) {
                    socket.emit('error', { message: 'User not authenticated' });
                    return;
                }
                
                this.gameManager.handleGameAction(socket, user, {
                    action: 'declareWin',
                    ...data
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
                
                // Simulate demo player joining current user's table
                const user = this.activeUsers.get(socket.id);
                if (user) {
                    const userRoom = this.gameManager.getUserRoom(socket.id);
                    const userTable = this.gameManager.getUserTable(socket.id);
                    
                    console.log(`🤖 Demo player joining room: ${userRoom?.id}, table: ${userTable?.id}`);
                    
                    if (userRoom && userTable) {
                        // Create mock socket for demo player
                        const demoSocket = { 
                            id: demoSocketId, 
                            join: () => {},
                            emit: () => {}
                        };
                        
                        const result = this.gameManager.assignPlayerToTable(userRoom, demoSocketId, demoPlayer);
                        console.log(`🤖 Demo player join result:`, result);
                        
                        if (result.success) {
                            // Notify all players in the table
                            socket.to(`table_${userTable.id}`).emit('playerJoined', {
                                player: demoPlayer,
                                tableInfo: result.table
                            });
                            
                            socket.emit('playerJoined', {
                                player: demoPlayer,
                                tableInfo: result.table
                            });
                        }
                    }
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
        this.server.listen(this.port, () => {
            console.log(`🚀 Okey Nostalji Server running on port ${this.port}`);
            console.log(`🌐 Open http://localhost:${this.port} to play!`);
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
