// Tenant-spezifischer Okey Server
// Dieser läuft für jeden Kunden separat

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Import your existing Okey game components
const GameManager = require('./src/game/GameManager');
const DatabaseManager = require('./src/DatabaseManager');
const AuthManager = require('./src/AuthManager');

class TenantOkeyServer {
    constructor() {
        this.tenantId = process.env.TENANT_ID || 'default';
        this.port = process.env.PORT || 4000;
        this.maxPlayers = parseInt(process.env.MAX_PLAYERS) || 50;
        this.dbPath = process.env.DB_PATH || './database.sqlite';
        
        console.log(`🎮 Starting Okey instance for tenant: ${this.tenantId}`);
        console.log(`📍 Port: ${this.port}, Max Players: ${this.maxPlayers}`);
        
        this.setupServer();
        this.setupGame();
    }

    setupServer() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        // Serve static files (your existing public folder)
        this.app.use(express.static('public'));
        this.app.use(express.json());

        // Add tenant branding
        this.app.get('/', (req, res) => {
            // You can customize this per tenant
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // Add tenant info endpoint
        this.app.get('/api/tenant-info', (req, res) => {
            res.json({
                tenantId: this.tenantId,
                maxPlayers: this.maxPlayers,
                currentPlayers: this.getCurrentPlayerCount()
            });
        });
    }

    setupGame() {
        // Initialize your existing game components with tenant-specific settings
        this.databaseManager = new DatabaseManager(this.dbPath);
        this.authManager = new AuthManager(this.databaseManager);
        this.gameManager = new GameManager(this.io);

        // Track current players for this tenant
        this.currentPlayers = new Set();

        this.setupSocketHandlers();
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            // Check player limit
            if (this.currentPlayers.size >= this.maxPlayers) {
                socket.emit('error', { 
                    message: `Server voll! Maximale Spieleranzahl (${this.maxPlayers}) erreicht.`,
                    code: 'SERVER_FULL'
                });
                socket.disconnect();
                return;
            }

            console.log(`👤 Player connected to ${this.tenantId}: ${socket.id}`);
            this.currentPlayers.add(socket.id);

            // Your existing socket handlers here
            this.setupExistingSocketHandlers(socket);

            socket.on('disconnect', () => {
                console.log(`👋 Player disconnected from ${this.tenantId}: ${socket.id}`);
                this.currentPlayers.delete(socket.id);
                
                // Clean up game state
                this.gameManager.leaveRoom(socket.id);
            });
        });
    }

    setupExistingSocketHandlers(socket) {
        // Copy your existing socket handlers from server.js
        // But add tenant-specific logging and limits

        socket.on('guest-login', async (data) => {
            try {
                const { guestName } = data;
                
                if (!guestName || guestName.length < 2) {
                    socket.emit('authenticated', { 
                        success: false, 
                        message: 'Gast-Name muss mindestens 2 Zeichen haben' 
                    });
                    return;
                }

                const guestUser = {
                    id: socket.id,
                    username: guestName,
                    isGuest: true,
                    score: 1000,
                    avatar: 'guest',
                    tenantId: this.tenantId
                };

                socket.user = guestUser;
                socket.emit('authenticated', { 
                    success: true, 
                    user: guestUser,
                    tenantInfo: {
                        id: this.tenantId,
                        maxPlayers: this.maxPlayers,
                        currentPlayers: this.currentPlayers.size
                    }
                });

                console.log(`🎭 Guest authenticated in ${this.tenantId}: ${guestName}`);
            } catch (error) {
                console.error('Guest login error:', error);
                socket.emit('authenticated', { 
                    success: false, 
                    message: 'Login fehlgeschlagen' 
                });
            }
        });

        socket.on('getRooms', () => {
            const rooms = Array.from(this.gameManager.rooms.values()).map(room => ({
                id: room.id,
                name: room.name,
                type: room.type,
                playerCount: room.players.size,
                maxPlayers: room.maxPlayers,
                minScore: room.minScore,
                tables: Array.from(room.tables.values()).map(table => ({
                    id: table.id,
                    players: table.players.length,
                    status: table.status
                })),
                waitingCount: room.waitingPlayers.length
            }));

            socket.emit('roomList', { rooms });
        });

        socket.on('joinTable', (data) => {
            if (!socket.user) {
                socket.emit('error', { message: 'Nicht authentifiziert' });
                return;
            }

            const { roomId, tableId } = data;
            
            try {
                const result = this.gameManager.joinRoom(socket, socket.user, 'okey', roomId);
                
                if (result.success) {
                    socket.emit('joinedRoom', {
                        success: true,
                        room: result.room,
                        tableId: tableId || 'auto-assigned'
                    });
                    
                    console.log(`🪑 Player ${socket.user.username} joined table in ${this.tenantId}`);
                } else {
                    socket.emit('joinedRoom', {
                        success: false,
                        message: result.message || 'Fehler beim Beitreten'
                    });
                }
            } catch (error) {
                console.error('Join table error:', error);
                socket.emit('error', { message: 'Fehler beim Tisch-Beitritt' });
            }
        });

        // Add all your other existing socket handlers...
        // drawTile, discardTile, declareWin, etc.
    }

    getCurrentPlayerCount() {
        return this.currentPlayers.size;
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`🎮 Tenant "${this.tenantId}" running on port ${this.port}`);
            console.log(`👥 Max players: ${this.maxPlayers}`);
            console.log(`💾 Database: ${this.dbPath}`);
        });
    }

    stop() {
        this.server.close();
        console.log(`🛑 Tenant "${this.tenantId}" stopped`);
    }
}

// Start tenant server if run directly
if (require.main === module) {
    const tenantServer = new TenantOkeyServer();
    tenantServer.start();
}

module.exports = TenantOkeyServer;
