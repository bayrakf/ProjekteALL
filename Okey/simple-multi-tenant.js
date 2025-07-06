const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Import Okey game components
const GameManager = require('./src/game/GameManager');
const DatabaseManager = require('./src/DatabaseManager');
const AuthManager = require('./src/AuthManager');

class SimpleMultiTenant {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: { origin: "*", methods: ["GET", "POST"] }
        });
        
        this.tenants = new Map();
        this.setupDatabase();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocket();
    }

    setupDatabase() {
        this.db = new sqlite3.Database('./tenants.db');
        this.db.serialize(() => {
            this.db.run(`CREATE TABLE IF NOT EXISTS tenants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subdomain TEXT UNIQUE,
                plan TEXT DEFAULT 'starter',
                max_players INTEGER DEFAULT 50,
                custom_domain TEXT,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
        });
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static('admin-panel'));
        
        // Tenant detection middleware
        this.app.use((req, res, next) => {
            const host = req.get('host');
            console.log(`🌐 Request: ${host}${req.url}`);
            
            if (host.includes('.localhost:3000')) {
                req.tenant = host.split('.')[0];
                req.isAdmin = false;
                console.log(`🎮 Tenant request: ${req.tenant}`);
            } else if (host === 'localhost:3000') {
                req.isAdmin = true;
                console.log(`📊 Admin request`);
            } else {
                req.tenant = host.split('.')[0];
                req.isAdmin = false;
            }
            next();
        });
    }

    setupRoutes() {
        // Admin API
        this.app.get('/api/tenants', (req, res) => {
            if (!req.isAdmin) return res.status(403).json({ error: 'Forbidden' });
            
            this.db.all('SELECT * FROM tenants ORDER BY created_at DESC', (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(rows);
            });
        });

        this.app.post('/api/tenants', (req, res) => {
            if (!req.isAdmin) return res.status(403).json({ error: 'Forbidden' });
            
            const { subdomain, plan = 'starter' } = req.body;
            const maxPlayers = { starter: 50, pro: 200, enterprise: 1000 }[plan] || 50;

            this.db.run(
                'INSERT INTO tenants (subdomain, plan, max_players) VALUES (?, ?, ?)',
                [subdomain, plan, maxPlayers],
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    
                    // Initialize tenant
                    this.initializeTenant(subdomain, plan, maxPlayers);
                    
                    res.json({
                        id: this.lastID,
                        subdomain,
                        plan,
                        maxPlayers,
                        status: 'active'
                    });
                }.bind(this)
            );
        });

        // Serve tenant game or admin panel
        this.app.get('/', (req, res) => {
            if (req.isAdmin) {
                res.sendFile(path.join(__dirname, 'admin-panel', 'index.html'));
            } else {
                this.serveTenantGame(req, res);
            }
        });

        // Static files for tenants
        this.app.use('/static', express.static('public'));
    }

    serveTenantGame(req, res) {
        const tenant = this.tenants.get(req.tenant);
        
        if (!tenant) {
            // Try to load from database
            this.db.get('SELECT * FROM tenants WHERE subdomain = ?', [req.tenant], (err, dbTenant) => {
                if (err || !dbTenant) {
                    return res.status(404).send(`
                        <h1>🎮 Okey Game Not Found</h1>
                        <p>The game "${req.tenant}" does not exist.</p>
                        <a href="http://localhost:3000">← Admin Panel</a>
                    `);
                }
                
                this.initializeTenant(dbTenant.subdomain, dbTenant.plan, dbTenant.max_players);
                res.redirect(req.originalUrl);
            });
            return;
        }

        // Serve customized game page
        const gameHtml = `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${req.tenant} - Okey Nostalji</title>
    <link rel="stylesheet" href="/static/style.css">
    <style>
        .tenant-brand {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            text-align: center;
            font-size: 18px;
            font-weight: bold;
        }
        .tenant-info {
            background: #f8fafc;
            padding: 10px;
            text-align: center;
            font-size: 14px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="tenant-brand">
        🎮 ${req.tenant.charAt(0).toUpperCase() + req.tenant.slice(1)} Casino
    </div>
    <div class="tenant-info">
        Plan: ${tenant.plan.toUpperCase()} | Max Players: ${tenant.maxPlayers} | Online: <span id="online-count">0</span>
    </div>
    
    <!-- Your existing game HTML here -->
    <div id="app">
        <div id="login-screen" class="screen">
            <div class="login-container">
                <h1>🎮 Okey Nostalji</h1>
                <div class="login-form">
                    <input type="text" id="guest-name" placeholder="Dein Name" maxlength="20">
                    <button id="guest-login-btn">Als Gast spielen</button>
                </div>
            </div>
        </div>
        
        <div id="room-screen" class="screen" style="display: none;">
            <div class="room-container">
                <h2>Räume auswählen</h2>
                <div id="rooms-list"></div>
            </div>
        </div>
        
        <div id="game-screen" class="screen" style="display: none;">
            <div id="game-container">
                <div id="game-board"></div>
                <div id="player-hand"></div>
                <div id="game-info"></div>
            </div>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        const tenantInfo = {
            subdomain: '${req.tenant}',
            plan: '${tenant.plan}',
            maxPlayers: ${tenant.maxPlayers}
        };
        
        // Add tenant-specific logging
        console.log('🎮 Connected to tenant:', tenantInfo);
        
        // Your existing game.js code here with tenant awareness
        socket.on('connect', () => {
            console.log('✅ Connected to', tenantInfo.subdomain);
            document.getElementById('online-count').textContent = '1+';
        });
        
        document.getElementById('guest-login-btn').addEventListener('click', () => {
            const guestName = document.getElementById('guest-name').value.trim();
            if (guestName.length < 2) {
                alert('Name muss mindestens 2 Zeichen haben');
                return;
            }
            
            socket.emit('guest-login', { guestName: guestName });
        });
        
        socket.on('authenticated', (data) => {
            if (data.success) {
                console.log('🔐 Authenticated:', data.user);
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('room-screen').style.display = 'block';
                
                // Load rooms
                socket.emit('getRooms');
            } else {
                alert('Login fehlgeschlagen: ' + data.message);
            }
        });
        
        socket.on('roomList', (data) => {
            const roomsList = document.getElementById('rooms-list');
            roomsList.innerHTML = data.rooms.map(room => 
                \`<div class="room-card" onclick="joinRoom('\${room.id}')">
                    <h3>\${room.name}</h3>
                    <p>Spieler: \${room.playerCount}/\${room.maxPlayers}</p>
                    <p>Tische: \${room.tables.length}</p>
                </div>\`
            ).join('');
        });
        
        function joinRoom(roomId) {
            socket.emit('joinTable', { roomId: roomId, tableId: 'table1' });
        }
        
        socket.on('joinedRoom', (data) => {
            if (data.success) {
                console.log('🪑 Joined room:', data.room.name);
                // Wait for game to start
            }
        });
        
        socket.on('gameStarted', (data) => {
            console.log('🎮 Game started!');
            document.getElementById('room-screen').style.display = 'none';
            document.getElementById('game-screen').style.display = 'block';
            
            // Initialize game board
            document.getElementById('game-info').innerHTML = 
                \`<h3>Spiel gestartet!</h3>
                <p>Okey: \${data.okeyTile?.color} \${data.okeyTile?.number}</p>
                <p>Deine Karten: \${Object.keys(data.playerHands)[0] ? data.playerHands[Object.keys(data.playerHands)[0]].length : 0}</p>\`;
        });
    </script>
    
    <style>
        body { margin: 0; font-family: Arial, sans-serif; }
        .screen { padding: 20px; }
        .login-container, .room-container { max-width: 400px; margin: 50px auto; text-align: center; }
        .login-form input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px; }
        .login-form button { width: 100%; padding: 12px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; }
        .room-card { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; cursor: pointer; }
        .room-card:hover { background: #f0f0f0; }
        #game-container { background: #2d5a87; color: white; padding: 20px; border-radius: 10px; }
    </style>
</body>
</html>
        `;
        
        res.send(gameHtml);
    }

    initializeTenant(subdomain, plan, maxPlayers) {
        if (this.tenants.has(subdomain)) return;
        
        console.log(`🎮 Initializing tenant: ${subdomain} (${plan}, ${maxPlayers} players)`);
        
        // Create tenant-specific game manager
        const tenantGameManager = new GameManager(this.io);
        
        this.tenants.set(subdomain, {
            subdomain,
            plan,
            maxPlayers,
            gameManager: tenantGameManager,
            players: new Set(),
            database: new DatabaseManager(`./tenant-dbs/${subdomain}.db`)
        });
    }

    setupSocket() {
        this.io.on('connection', (socket) => {
            console.log(`👤 User connected: ${socket.id}`);
            
            socket.on('guest-login', (data) => {
                const { guestName } = data;
                
                if (!guestName || guestName.length < 2) {
                    socket.emit('authenticated', { 
                        success: false, 
                        message: 'Name muss mindestens 2 Zeichen haben' 
                    });
                    return;
                }

                const user = {
                    id: socket.id,
                    username: guestName,
                    isGuest: true,
                    score: 1000,
                    avatar: 'guest'
                };

                socket.user = user;
                socket.emit('authenticated', { success: true, user });
                console.log(`🎭 Guest authenticated: ${guestName}`);
            });

            socket.on('getRooms', () => {
                // Get tenant from socket
                const tenantData = this.getTenantFromSocket(socket);
                if (!tenantData) return;
                
                const rooms = Array.from(tenantData.gameManager.rooms.values()).map(room => ({
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
                    }))
                }));

                socket.emit('roomList', { rooms });
            });

            socket.on('joinTable', (data) => {
                if (!socket.user) return;
                
                const tenantData = this.getTenantFromSocket(socket);
                if (!tenantData) return;
                
                // Check player limit for tenant
                if (tenantData.players.size >= tenantData.maxPlayers) {
                    socket.emit('error', { 
                        message: `Server voll! Maximale Spieleranzahl (${tenantData.maxPlayers}) erreicht.` 
                    });
                    return;
                }
                
                tenantData.players.add(socket.id);
                
                const { roomId } = data;
                const result = tenantData.gameManager.joinRoom(socket, socket.user, 'okey', roomId);
                
                if (result.success) {
                    socket.emit('joinedRoom', {
                        success: true,
                        room: result.room
                    });
                } else {
                    socket.emit('joinedRoom', {
                        success: false,
                        message: result.message
                    });
                }
            });

            socket.on('disconnect', () => {
                console.log(`👋 User disconnected: ${socket.id}`);
                
                // Remove from all tenants
                this.tenants.forEach(tenant => {
                    tenant.players.delete(socket.id);
                    tenant.gameManager.leaveRoom(socket.id);
                });
            });
        });
    }

    getTenantFromSocket(socket) {
        // In a real implementation, you'd store tenant info with the socket
        // For now, return the first tenant as a fallback
        return Array.from(this.tenants.values())[0];
    }

    start() {
        // Load existing tenants
        this.db.all('SELECT * FROM tenants WHERE status = "active"', (err, tenants) => {
            if (tenants) {
                tenants.forEach(tenant => {
                    this.initializeTenant(tenant.subdomain, tenant.plan, tenant.max_players);
                });
            }
            
            this.server.listen(3000, () => {
                console.log('🚀 Simple Multi-Tenant Okey Platform running on port 3000');
                console.log('📊 Admin Panel: http://localhost:3000');
                console.log('🎮 Example tenant: http://demo.localhost:3000');
            });
        });
    }
}

const platform = new SimpleMultiTenant();
platform.start();
