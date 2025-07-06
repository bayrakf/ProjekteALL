// Okey Game Frontend Logic
class OkeyGameClient {
    constructor() {
        this.socket = null;
        this.user = null;
        this.currentRoom = null;
        this.currentTable = null;
        this.gameState = null;
        this.playerHand = [];
        this.selectedTiles = [];
        this.isMyTurn = false;
        
        this.initializeSocket();
        this.setupEventListeners();
        this.setupDragAndDrop();
    }

    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('✅ Verbunden mit Server - Socket ID:', this.socket.id);
            this.updateConnectionStatus(true);
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Verbindung zum Server verloren');
            this.updateConnectionStatus(false);
            this.showNotification('Verbindung verloren. Versuche zu reconnecten...', 'error');
        });

        this.socket.on('authenticated', (data) => {
            console.log('🔐 Authentication response:', data);
            if (data.success) {
                this.user = data.user;
                this.showGameLobby();
                this.loadRooms();
                this.showNotification(`Willkommen, ${this.user.username}!`, 'success');
            } else {
                this.showNotification(data.message, 'error');
            }
        });

        this.socket.on('joinedRoom', (data) => {
            console.log('🏠 Joined room event received:', data);
            if (data.success) {
                this.currentRoom = data.roomId;
                this.currentTable = data.tableId;
                this.showGameTable(data.tableInfo);
                this.updatePlayerList(data.tableInfo.players);
                this.showNotification(`Erfolgreich Tisch ${data.tableId} beigetreten!`, 'success');
            } else {
                this.showNotification(data.message || 'Fehler beim Tisch beitreten', 'error');
            }
        });

        this.socket.on('error', (data) => {
            console.log('❌ Socket error received:', data);
            this.showNotification(data.message || 'Ein Fehler ist aufgetreten', 'error');
        });

        this.socket.on('playerJoined', (data) => {
            console.log('👤 Player joined event:', data);
            this.updatePlayerList(data.tableInfo.players);
            this.showNotification(`${data.player.username} ist dem Tisch beigetreten`, 'info');
            
            // Update room display if we're still in lobby
            if (this.currentRoom && !this.currentTable) {
                this.loadRooms();
            }
        });

        this.socket.on('playerLeft', (data) => {
            console.log('👤 Player left event:', data);
            this.updatePlayerList(data.tableInfo.players);
            this.showNotification(`${data.player ? data.player.username : 'Ein Spieler'} hat den Tisch verlassen`, 'info');
            
            // Update room display
            if (this.currentRoom && !this.currentTable) {
                this.loadRooms();
            }
        });

        this.socket.on('gameStarted', (data) => {
            console.log('🎮 Game started with authentic Okey data:', data);
            this.gameState = data.gameState;
            this.playerHand = data.playerHands[this.user.id] || [];
            this.okeyTile = data.okeyTile;
            this.indicatorTile = data.indicatorTile;
            this.isMyTurn = data.currentPlayer === this.user.id;
            
            this.startOkeyGame(data);
            this.showNotification('Authentic Okey Spiel gestartet!', 'success');
        });

        // Okey-specific socket events
        this.socket.on('tileDrawn', (data) => {
            console.log('🎲 Tile drawn event:', data);
            if (data.userId === this.user.id) {
                this.playerHand.push(data.tile);
                this.renderPlayerHand();
            }
            this.updateGameState(data.gameState);
            this.showNotification(`${data.username} hat einen Stein gezogen`, 'info');
        });

        this.socket.on('tileDiscarded', (data) => {
            console.log('🗑️ Tile discarded event:', data);
            this.updateLastDiscardedTile(data.tile);
            this.updateGameState(data.gameState);
            this.isMyTurn = data.gameState.currentPlayer === this.user.id;
            this.showNotification(`${data.username} hat einen Stein abgeworfen`, 'info');
        });

        this.socket.on('winDeclared', (data) => {
            console.log('🏆 Win declared event:', data);
            this.handleWinDeclared(data);
        });

        this.socket.on('gostergeShown', (data) => {
            console.log('🎯 Gösterge shown event:', data);
            this.showNotification(`${data.username} hat Gösterge gezeigt!`, 'warning');
        });

        this.socket.on('roundEnded', (data) => {
            console.log('🏁 Round ended event:', data);
            this.handleRoundEnd(data);
        });

        this.socket.on('matchEnded', (data) => {
            console.log('🎉 Match ended event:', data);
            this.handleMatchEnd(data);
        });

        // Additional Socket Events for Enhanced Gameplay
        this.socket.on('handSorted', (data) => {
            console.log('🔄 Hand sorted event:', data);
            this.playerHand = data.hand;
            this.renderPlayerHand();
            this.showNotification('Hand sortiert', 'info');
        });

        this.socket.on('turnChanged', (data) => {
            console.log('🔄 Turn changed event:', data);
            this.updateGameState(data.gameState);
            this.isMyTurn = data.currentPlayerId === this.user.id;
            this.updateTurnControls();
            
            if (this.isMyTurn) {
                this.showNotification('Ihr Zug!', 'success');
            } else {
                this.showNotification(`${data.currentPlayerName} ist dran`, 'info');
            }
        });

        this.socket.on('playerAction', (data) => {
            console.log('🎮 Player action event:', data);
            // Handle various player actions
            switch (data.action) {
                case 'tileDrawn':
                    this.showNotification(`${data.username} hat einen Stein gezogen`, 'info');
                    break;
                case 'tileDiscarded':
                    this.showNotification(`${data.username} hat einen Stein abgeworfen`, 'info');
                    this.updateLastDiscardedTile(data.tile);
                    break;
            }
        });

        this.socket.on('rooms', (data) => {
            console.log('🏠 Rooms data received:', data);
            this.currentRooms = data;
            this.renderRooms();
        });

        this.socket.on('tableUpdate', (data) => {
            console.log('🎲 Table update:', data);
            if (this.currentRoom) {
                this.loadRooms(); // Refresh room display
            }
        });

        // Ping/Pong für Connection Health
        setInterval(() => {
            if (this.socket.connected) {
                this.socket.emit('ping');
            }
        }, 30000);

        this.socket.on('pong', () => {
            this.updateConnectionStatus(true);
        });
    }

    setupEventListeners() {
        // Login Form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Guest Login
        const guestBtn = document.getElementById('guestLoginBtn');
        if (guestBtn) {
            guestBtn.addEventListener('click', () => {
                this.handleGuestLogin();
            });
        }

        // Register Form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }

        // Register Button (switch to register form)
        const registerBtn = document.getElementById('registerBtn');
        if (registerBtn) {
            registerBtn.addEventListener('click', () => {
                this.showRegisterForm();
            });
        }

        // Back to Login Button
        const backToLoginBtn = document.getElementById('backToLoginBtn');
        if (backToLoginBtn) {
            backToLoginBtn.addEventListener('click', () => {
                this.showLoginForm();
            });
        }

        // Start Game Button and dynamic buttons
        document.addEventListener('click', (e) => {
            console.log('🖱️ Click detected on:', e.target.className, e.target.id, e.target.dataset);
            
            if (e.target.id === 'startGameBtn') {
                console.log('🎮 Start game button clicked');
                this.startGameAtTable();
            }
            if (e.target.id === 'leaveTableBtn') {
                console.log('🚪 Leave table button clicked');
                this.leaveTable();
            }
            if (e.target.id === 'backToRoomsBtn') {
                console.log('🏠 Back to rooms button clicked');
                this.showGameLobby();
            }
            if (e.target.classList.contains('join-table-btn')) {
                console.log('🪑 Join table button clicked');
                const tableId = e.target.dataset.tableId;
                const roomId = e.target.dataset.roomId;
                console.log('📊 Table data:', { roomId, tableId });
                this.joinTable(roomId, tableId);
            }
        });

        // Chat
        const chatInput = document.getElementById('chatInput');
        const sendChatBtn = document.getElementById('sendChatBtn');
        
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendChatMessage();
                }
            });
        }
        
        if (sendChatBtn) {
            sendChatBtn.addEventListener('click', () => {
                this.sendChatMessage();
            });
        }

        // Game Actions
        document.addEventListener('click', (e) => {
            if (e.target.id === 'drawTileBtn') {
                this.drawTile();
            }
            if (e.target.id === 'discardBtn') {
                this.discardTile();
            }
            if (e.target.id === 'finishTurnBtn') {
                this.finishTurn();
            }
            if (e.target.id === 'declareWinBtn') {
                this.declareWin();
            }
            if (e.target.id === 'drawFromPileBtn') {
                console.log('🎲 Draw from pile button clicked');
                this.drawTile();
            }
            if (e.target.id === 'declareWinBtn') {
                console.log('🏆 Declare win button clicked');
                this.declareWin();
            }
            if (e.target.id === 'sortHandBtn') {
                console.log('📝 Sort hand button clicked');
                this.sortHand();
            }
        });

        // Tile Selection
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tile')) {
                const tileIndex = e.target.getAttribute('data-index');
                const tileId = e.target.getAttribute('data-tile-id');
                if (tileIndex !== null && this.playerHand[tileIndex]) {
                    this.selectTile(this.playerHand[tileIndex], parseInt(tileIndex));
                }
            }
        });
    }

    setupDragAndDrop() {
        // Drag and Drop für Tiles
        document.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('tile')) {
                e.dataTransfer.setData('text/plain', e.target.dataset.tileId);
                e.target.classList.add('dragging');
            }
        });

        document.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('tile')) {
                e.target.classList.remove('dragging');
            }
        });

        document.addEventListener('dragover', (e) => {
            if (e.target.classList.contains('drop-zone')) {
                e.preventDefault();
            }
        });

        document.addEventListener('drop', (e) => {
            if (e.target.classList.contains('drop-zone')) {
                e.preventDefault();
                const tileId = e.dataTransfer.getData('text/plain');
                this.handleTileDrop(tileId, e.target);
            }
        });
    }

    async handleLogin() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            this.showNotification('Bitte alle Felder ausfüllen', 'error');
            return;
        }

        console.log('🔐 Attempting login for:', username);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            console.log('📡 Login response:', data);

            if (data.success) {
                this.user = data.user;
                
                // Gehe direkt zur Lobby
                this.showGameLobby();
                this.loadRooms();
                this.updateHeader();
                this.showNotification(`Willkommen zurück, ${data.user.username}!`, 'success');
                
                // Socket-Authentifizierung im Hintergrund
                if (this.socket && this.socket.connected) {
                    this.socket.emit('authenticate', {
                        token: data.token,
                        userId: data.user.id,
                        username: data.user.username,
                        isGuest: false
                    });
                }
            } else {
                this.showNotification(data.message || 'Login fehlgeschlagen', 'error');
            }
        } catch (error) {
            console.error('❌ Login error:', error);
            this.showNotification('Verbindungsfehler. Versuchen Sie es später erneut.', 'error');
        }
    }

    async handleGuestLogin() {
        console.log('🎭 Starting guest login...');
        
        const guestName = `Gast${Math.floor(Math.random() * 10000)}`;
        
        // Erstelle Benutzer lokal
        this.user = {
            id: Date.now(),
            username: guestName,
            isGuest: true,
            score: 0
        };
        
        console.log('👤 Guest user created:', this.user);
        
        // Gehe direkt zur Lobby (ohne auf Socket-Antwort zu warten)
        this.showGameLobby();
        this.loadRooms();
        this.updateHeader();
        this.showNotification(`Willkommen, ${guestName}!`, 'success');
        
        // Versuche Socket-Authentifizierung im Hintergrund
        if (this.socket && this.socket.connected) {
            console.log('📡 Attempting socket authentication...');
            this.socket.emit('authenticate', {
                userId: this.user.id,
                username: this.user.username,
                isGuest: true
            });
        } else {
            console.log('⚠️ Socket not connected, continuing without server sync');
        }
    }

    async handleRegister() {
        const username = document.getElementById('regUsername').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;

        if (!username || !email || !password) {
            this.showNotification('Bitte alle Felder ausfüllen', 'error');
            return;
        }

        console.log('📝 Attempting registration for:', username);

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();
            console.log('📡 Registration response:', data);

            if (data.success) {
                this.showNotification('Registrierung erfolgreich! Sie wurden automatisch eingeloggt.', 'success');
                
                this.user = data.user;
                
                // Gehe direkt zur Lobby
                this.showGameLobby();
                this.loadRooms();
                this.updateHeader();
                
                // Socket-Authentifizierung im Hintergrund
                if (this.socket && this.socket.connected && data.token) {
                    this.socket.emit('authenticate', {
                        token: data.token,
                        userId: data.user.id,
                        username: data.user.username,
                        isGuest: false
                    });
                }
            } else {
                this.showNotification(data.message || 'Registrierung fehlgeschlagen', 'error');
            }
        } catch (error) {
            console.error('❌ Registration error:', error);
            this.showNotification('Verbindungsfehler. Versuchen Sie es später erneut.', 'error');
        }
    }

    // Test Functionality - Add demo players for testing
    addDemoPlayers() {
        if (!this.socket || this.gameState !== 'waiting') return;
        
        console.log('🤖 Adding demo players for testing...');
        
        // Simulate 3 additional players joining
        const demoPlayers = [
            { id: 'demo1', username: 'Demo Player 1', score: 1500 },
            { id: 'demo2', username: 'Demo Player 2', score: 1200 },
            { id: 'demo3', username: 'Demo Player 3', score: 1800 }
        ];
        
        demoPlayers.forEach((demoPlayer, index) => {
            setTimeout(() => {
                this.socket.emit('demoPlayerJoin', demoPlayer);
            }, index * 1000);
        });
    }

    // Quick start for testing
    quickStart() {
        console.log('⚡ Quick start initiated');
        
        // Join as guest and add demo players
        this.handleGuestLogin();
        
        setTimeout(() => {
            // Join first available room/table
            if (this.currentRooms && this.currentRooms.length > 0) {
                this.joinTable(this.currentRooms[0].id, this.currentRooms[0].tables[0].id);
                
                // Add demo players after joining
                setTimeout(() => {
                    this.addDemoPlayers();
                }, 2000);
            }
        }, 1000);
    }

    // Enhanced room loading with better error handling
    async loadRooms() {
        try {
            console.log('🏠 Loading rooms...');
            
            // First try server API
            if (this.socket && this.socket.connected) {
                this.socket.emit('getRooms');
                
                // Fallback timeout
                setTimeout(() => {
                    if (!this.currentRooms) {
                        console.log('⚠️ Using fallback room data after timeout');
                        this.useFallbackRooms();
                    }
                }, 2000);
            } else {
                console.log('⚠️ Socket not available, using fallback data immediately');
                this.useFallbackRooms();
            }
            
        } catch (error) {
            console.error('❌ Error loading rooms:', error);
            this.showNotification('Fehler beim Laden der Räume', 'error');
            this.useFallbackRooms();
        }
    }
    
    useFallbackRooms() {
        const fallbackRooms = [
            {
                id: 'room1',
                name: 'Anfänger Salon',
                type: 'okey',
                playerCount: 3,
                maxPlayers: 50,
                tables: [
                    { id: 'table1', players: [] },
                    { id: 'table2', players: [{name: 'TestUser'}] },
                    { id: 'table3', players: [{name: 'User1'}, {name: 'User2'}] }
                ]
            },
            {
                id: 'room2', 
                name: 'Fortgeschrittene',
                type: 'okey',
                playerCount: 8,
                maxPlayers: 50,
                tables: [
                    { id: 'table4', players: [] },
                    { id: 'table5', players: [{name: 'Pro1'}] }
                ]
            }
        ];
        
        console.log('✅ Using fallback mock rooms:', fallbackRooms);
        this.currentRooms = fallbackRooms;
        this.displayRooms(fallbackRooms);
    }

    // Enhanced rendering with better UI  
    displayRooms(rooms) {
        console.log('🏠 Displaying rooms:', rooms);
        
        const roomsGrid = document.getElementById('roomsGrid');
        if (!roomsGrid) {
            console.error('❌ roomsGrid element not found!');
            return;
        }

        roomsGrid.innerHTML = '';

        rooms.forEach(room => {
            console.log('🏠 Creating room card for:', room.name);
            
            const roomCard = document.createElement('div');
            roomCard.className = 'room-card';
            roomCard.innerHTML = `
                <div class="room-header">
                    <div class="room-name">${room.name}</div>
                    <div class="room-stats">
                        👥 ${room.playerCount}/${room.maxPlayers} | 
                        ⭐ Min: ${room.minScore || 0}
                    </div>
                </div>
                <div class="tables-section">
                    <h4>Tische:</h4>
                    <div class="room-tables">
                        ${room.tables.map(table => `
                            <div class="table-info">
                                <span>Tisch ${table.id}</span>
                                <span>${table.players.length}/4 Spieler</span>
                                <div class="table-players">
                                    ${table.players.map(player => 
                                        `<span class="player-tag">${player.name || player.username}</span>`
                                    ).join('')}
                                    ${Array.from({length: 4 - table.players.length}, () => 
                                        '<span class="empty-slot">Leer</span>'
                                    ).join('')}
                                </div>
                                <button class="join-table-btn btn btn-primary" 
                                        data-room-id="${room.id}" 
                                        data-table-id="${table.id}"
                                        ${table.players.length >= 4 ? 'disabled' : ''}>
                                    ${table.players.length >= 4 ? 'Voll' : 'Beitreten'}
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            roomsGrid.appendChild(roomCard);
        });
        
        console.log('✅ Room cards added to grid');
    }

    // Enhanced table joining
    joinTable(roomId, tableId) {
        if (!this.user) {
            this.showNotification('Bitte erst einloggen!', 'error');
            return;
        }

        console.log(`🎲 Joining table ${tableId} in room ${roomId}`);        
        if (this.socket && this.socket.connected) {
            this.socket.emit('joinTable', { roomId, tableId });
        } else {
            // Fallback: simulate joining
            console.log('⚠️ Socket not available, simulating join');
            this.simulateTableJoin(roomId, tableId);
        }
    }

    leaveTable() {
        if (this.currentTable) {
            if (this.socket && this.socket.connected) {
                this.socket.emit('leaveTable', {
                    tableId: this.currentTable,
                    userId: this.user.id
                });
            }
            this.currentTable = null;
            this.currentRoom = null;
            this.showGameLobby();
            this.showNotification('Tisch verlassen', 'info');
        }
    }

    startGameAtTable() {
        if (!this.currentTable) {
            this.showNotification('Sie sind nicht an einem Tisch!', 'error');
            return;
        }
        
        if (this.socket && this.socket.connected) {
            this.socket.emit('startGame', { tableId: this.currentTable });
            this.showNotification('Spiel wird gestartet...', 'info');
        } else {
            // Fallback: simulate game start
            this.simulateGameStart();
        }
    }
    
    simulateTableJoin(roomId, tableId) {
        this.currentRoom = roomId;
        this.currentTable = tableId;
        
        const mockTableInfo = {
            id: tableId,
            roomId: roomId,
            players: [
                { id: this.user.id, username: this.user.username, score: this.user.score }
            ]
        };
        
        this.showGameTable(mockTableInfo);
        this.showNotification(`Tisch ${tableId} beigetreten (Offline-Modus)`, 'warning');
        
        // Simulate game start after adding demo players
        setTimeout(() => {
            this.simulateGameStart();
        }, 3000);
    }

    simulateGameStart() {
        console.log('🎮 Simulating game start for testing...');
        
        // Generate mock game data
        const mockGameData = {
            gameState: {
                currentPlayer: this.user.id,
                round: 1,
                tilesLeft: 80,
                gameState: 'playing'
            },
            playerHands: {
                [this.user.id]: this.generateMockHand()
            },
            okeyTile: { color: 'red', number: 5, isOkey: true },
            indicatorTile: { color: 'red', number: 4 },
            scores: {
                [this.user.username]: 20,
                'Demo Player 1': 20,
                'Demo Player 2': 20,
                'Demo Player 3': 20
            }
        };
        
        this.startOkeyGame(mockGameData);
    }

    showGameTable(tableInfo) {
        console.log('🎮 Showing game table:', tableInfo);
        
        const roomSelection = document.getElementById('roomSelection');
        const gameScreen = document.getElementById('gameScreen');
        
        if (roomSelection) {
            roomSelection.style.display = 'none';
            console.log('✅ Room selection hidden');
        }
        
        if (gameScreen) {
            gameScreen.style.display = 'block';
            gameScreen.classList.remove('hidden');
            console.log('✅ Game screen shown');
        }
        
        this.updatePlayerList(tableInfo.players);
        this.showNotification(`Willkommen am Tisch ${tableInfo.tableId}!`, 'info');
        
        // Initialize Okey game
        this.initializeOkeyGame();
    }
    
    updatePlayerList(players) {
        console.log('👥 Updating player list:', players);
        
        const playerList = document.getElementById('playersList');
        if (!playerList) {
            console.error('❌ playersList element not found!');
            return;
        }

        playerList.innerHTML = '';
        players.forEach((player, index) => {
            const playerElement = document.createElement('div');
            playerElement.className = 'player-item';
            playerElement.innerHTML = `
                <div class="player-name">${player.username}</div>
                <div class="player-score">Score: ${player.score || 0}</div>
                <div class="player-status ${player.isOnline !== false ? 'online' : 'offline'}">
                    ${player.isOnline !== false ? '🟢 Online' : '🔴 Offline'}
                </div>
                ${player.isGuest ? '<div class="guest-badge">Gast</div>' : ''}
            `;
            playerList.appendChild(playerElement);
        });

        // Start Button nur anzeigen wenn genug Spieler da sind
        const startBtn = document.getElementById('startGameBtn');
        if (startBtn) {
            startBtn.style.display = players.length >= 2 ? 'block' : 'none';
        }
        
        console.log('✅ Player list updated with', players.length, 'players');
    }
    
    initializeOkeyGame() {
        console.log('🎲 Initializing Okey game...');
        
        // Mock hand for demonstration
        this.playerHand = this.generateMockHand();
        this.renderPlayerHand();
        
        // Mock game state
        this.gameState = {
            currentPlayer: this.user.id,
            okeyTile: { number: 7, color: 'red' },
            indicatorTile: { number: 6, color: 'red' }
        };
        
        this.updateGameState();
        this.showNotification('Okey-Spiel initialisiert! (Mock-Daten)', 'info');
    }
    
    generateMockHand() {
        const colors = ['red', 'black', 'blue', 'yellow'];
        const hand = [];
        
        // Generate 14 random tiles for demonstration
        for (let i = 0; i < 14; i++) {
            hand.push({
                id: `tile_${i}`,
                number: Math.floor(Math.random() * 13) + 1,
                color: colors[Math.floor(Math.random() * colors.length)],
                isOkey: false,
                isFakeOkey: false
            });
        }
        
        // Add one Okey tile
        hand[13] = {
            id: 'tile_okey',
            number: 7,
            color: 'red',
            isOkey: true,
            isFakeOkey: false
        };
        
        return hand;
    }

    // Removed duplicate loadRooms function - using the enhanced version above

    // Removed duplicate displayRooms function - using the enhanced version above

    // Removed duplicate joinTable function - using the enhanced version above

    // Missing helper functions
    updateConnectionStatus(isConnected) {
        const statusIndicator = document.querySelector('.status-indicator');
        if (statusIndicator) {
            statusIndicator.style.background = isConnected ? '#28a745' : '#dc3545';
        }
        
        const connectionStatus = document.querySelector('.connection-status span');
        if (connectionStatus) {
            connectionStatus.textContent = isConnected ? 'Verbunden' : 'Getrennt';
        }
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">
                    ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
                </span>
                <span class="notification-message">${message}</span>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remove after delay
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
        
        console.log(`📢 Notification (${type}): ${message}`);
    }
    
    showLoginForm() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (loginForm) loginForm.style.display = 'block';
        if (registerForm) registerForm.style.display = 'none';
    }
    
    showRegisterForm() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'block';
    }
    
    showGameLobby() {
        console.log('🎮 Showing game lobby...');
        
        const loginScreen = document.getElementById('loginScreen');
        const roomSelection = document.getElementById('roomSelection');
        const gameScreen = document.getElementById('gameScreen');
        
        if (loginScreen) {
            loginScreen.style.display = 'none';
            console.log('✅ Login screen hidden');
        }
        
        if (roomSelection) {
            roomSelection.style.display = 'block';
            roomSelection.classList.remove('hidden');
            console.log('✅ Room selection shown');
        }
        
        if (gameScreen) {
            gameScreen.style.display = 'none';
            console.log('✅ Game screen hidden');
        }
        
        // Update header 
        this.updateHeader();
    }
    
    updateHeader() {
        const userProfile = document.getElementById('userProfile');
        const currentUsername = document.getElementById('currentUsername');
        const onlineCount = document.getElementById('onlinePlayersCount');
        
        if (this.user && userProfile && currentUsername) {
            userProfile.classList.remove('hidden');
            currentUsername.textContent = this.user.username;
            
            const userScore = document.getElementById('userScore');
            if (userScore) {
                userScore.textContent = this.user.score || 0;
            }
        }
        
        if (onlineCount) {
            // Mock online count for now
            onlineCount.textContent = Math.floor(Math.random() * 50) + 10;
        }
    }
    
    sendChatMessage() {
        const chatInput = document.getElementById('chatInput');
        if (!chatInput || !chatInput.value.trim()) return;
        
        const message = chatInput.value.trim();
        chatInput.value = '';
        
        if (this.socket && this.socket.connected && this.currentTable) {
            this.socket.emit('chatMessage', {
                tableId: this.currentTable,
                message: message,
                username: this.user.username
            });
        }
        
        // Add to local chat
        this.addChatMessage(this.user.username, message, 'own');
    }
    
    addChatMessage(username, message, type = 'other') {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${type}`;
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="username">${username}</span>
                <span class="timestamp">${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="message-content">${message}</div>
        `;
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    handleTileDrop(tileId, dropTarget) {
        console.log('🎯 Tile dropped:', tileId, 'on', dropTarget);
        // Implement drag & drop logic here
    }
    
    updateLastDiscardedTile(tile) {
        const discardPile = document.getElementById('discardPile');
        if (discardPile && tile) {
            discardPile.innerHTML = `
                <div class="tile ${tile.color}">
                    <div class="tile-number">${tile.number}</div>
                    <div class="tile-color">${this.getColorSymbol(tile.color)}</div>
                </div>
            `;
        }
    }
    
    handleWinDeclared(data) {
        this.showNotification(`🏆 ${data.winner} hat gewonnen! Grund: ${data.reason}`, 'success');
        // Show win dialog or results
    }
    
    handleRoundEnd(data) {
        this.showNotification(`🏁 Runde beendet. Gewinner: ${data.winner}`, 'info');
        // Update scores, prepare next round
    }
    
    handleMatchEnd(data) {
        this.showNotification(`🎉 Spiel beendet! Endgewinner: ${data.finalWinner}`, 'success');
        // Show final results
    }
    
    startOkeyGame(gameData) {
        console.log('🎮 Starting Okey game with data:', gameData);
        
        // Update game state
        this.gameState = gameData.gameState;
        this.playerHand = gameData.playerHands && gameData.playerHands[this.user.id] || this.generateMockHand();
        this.okeyTile = gameData.okeyTile;
        this.indicatorTile = gameData.indicatorTile;
        this.isMyTurn = gameData.gameState && gameData.gameState.currentPlayer === this.user.id;
        
        // Update UI
        this.renderPlayerHand();
        this.updateOkeyInfo();
        this.updateTurnControls();
        this.showGameControls();
        
        this.showNotification('🎮 Okey Spiel gestartet!', 'success');
    }
    
    updateOkeyInfo() {
        // Update Gösterge (indicator) tile display
        const indicatorElements = document.querySelectorAll('.indicator-tile, #indicatorTileDisplay');
        indicatorElements.forEach(element => {
            if (element && this.indicatorTile) {
                element.innerHTML = `
                    <strong>Gösterge:</strong> 
                    <span class="tile-display ${this.indicatorTile.color}">
                        ${this.indicatorTile.number} ${this.getColorSymbol(this.indicatorTile.color)}
                    </span>
                `;
            }
        });
        
        // Update Okey tile display
        const okeyElements = document.querySelectorAll('.okey-tile, #okeyTileDisplay');
        okeyElements.forEach(element => {
            if (element && this.okeyTile) {
                element.innerHTML = `
                    <strong>Okey:</strong> 
                    <span class="tile-display ${this.okeyTile.color} okey">
                        ${this.okeyTile.number} ${this.getColorSymbol(this.okeyTile.color)}
                    </span>
                `;
            }
        });
    }

    renderPlayerHand() {
        console.log('🎯 Rendering player hand...');
        const handTilesContainer = document.getElementById('handTiles');
        if (!handTilesContainer) {
            console.error('❌ handTiles container not found!');
            return;
        }

        // Use playerHand property directly if available, otherwise check gameState
        let hand = this.playerHand;
        
        if (!hand && this.gameState && this.gameState.players) {
            const currentPlayer = this.gameState.players.find(p => p.id === this.user.id);
            hand = currentPlayer ? currentPlayer.hand : null;
        }
        
        if (!hand) {
            console.log('⚠️ No hand data available, using mock data');
            hand = this.generateMockHand();
            this.playerHand = hand;
        }

        handTilesContainer.innerHTML = '';

        if (hand.length === 0) {
            handTilesContainer.innerHTML = '<div class="no-tiles">Keine Steine vorhanden</div>';
            return;
        }

        hand.forEach((tile, index) => {
            const tileElement = this.createTileElement(tile, index);
            handTilesContainer.appendChild(tileElement);
        });

        console.log('✅ Player hand rendered with', hand.length, 'tiles');
    }

    createTileElement(tile, index) {
        const tileDiv = document.createElement('div');
        tileDiv.className = `tile ${tile.color}`;
        
        if (tile.isOkey) {
            tileDiv.classList.add('okey');
        }
        if (tile.isFakeOkey) {
            tileDiv.classList.add('fake-okey');
        }

        tileDiv.innerHTML = `
            <div class="tile-number">${tile.isOkey ? 'OK' : tile.number}</div>
            <div class="tile-color"></div>
        `;

        tileDiv.setAttribute('data-tile-id', tile.id);
        tileDiv.setAttribute('data-index', index);

        // Add click handler for tile selection
        tileDiv.addEventListener('click', () => {
            this.selectTile(tile, index);
        });

        // Add drag handlers for mobile
        tileDiv.addEventListener('touchstart', (e) => {
            this.handleTileTouch(e, tile, index);
        });

        return tileDiv;
    }

    selectTile(tile, index) {
        console.log('🎯 Tile selected:', tile);
        
        // Remove selection from other tiles
        document.querySelectorAll('.tile.selected').forEach(t => {
            t.classList.remove('selected');
        });

        // Select this tile
        const tileElement = document.querySelector(`[data-index="${index}"]`);
        if (tileElement) {
            tileElement.classList.add('selected');
            this.selectedTile = { tile, index };
        }
    }

    handleTileTouch(event, tile, index) {
        event.preventDefault();
        this.selectTile(tile, index);
    }

    renderGameBoard() {
        console.log('🎲 Rendering game board...');
        
        // Update player positions
        this.updatePlayerPositions();
        
        // Update discard pile
        this.updateDiscardPile();
        
        // Update deck counter
        this.updateDeckCounter();
        
        // Update gösterge tile
        this.updateGostergeTile();
    }

    updatePlayerPositions() {
        const players = this.gameState.players || [];
        
        players.forEach((player, index) => {
            const position = ['bottom', 'right', 'top', 'left'][index];
            const playerElement = document.querySelector(`.player-${position}`);
            
            if (playerElement) {
                const nameElement = playerElement.querySelector('.player-name');
                const scoreElement = playerElement.querySelector('.player-score');
                
                if (nameElement) nameElement.textContent = player.username || `Spieler ${index + 1}`;
                if (scoreElement) scoreElement.textContent = `Score: ${player.score || 0}`;
                
                // Update tile count for other players
                if (player.id !== this.user.id) {
                    const tileCountElement = playerElement.querySelector('.tile-count');
                    if (tileCountElement) {
                        tileCountElement.textContent = `${player.hand ? player.hand.length : 0} Taş`;
                    }
                }
            }
        });
    }

    updateDiscardPile() {
        const discardPile = document.getElementById('discardPile');
        if (!discardPile) return;

        discardPile.innerHTML = '';

        if (this.gameState.discardPile && this.gameState.discardPile.length > 0) {
            // Show last few discarded tiles
            const recentTiles = this.gameState.discardPile.slice(-5);
            recentTiles.forEach(tile => {
                const tileElement = this.createTileElement(tile);
                tileElement.classList.add('discarded');
                tileElement.addEventListener('click', () => {
                    this.drawFromDiscardPile(tile);
                });
                discardPile.appendChild(tileElement);
            });
        }
    }

    updateDeckCounter() {
        const tilesLeft = document.querySelector('.tiles-left');
        if (tilesLeft) {
            const remaining = this.gameState.deck ? this.gameState.deck.length : 106;
            tilesLeft.textContent = `${remaining} Taş Kaldı`;
        }
    }

    updateGostergeTile() {
        const gostergeElement = document.querySelector('.gosterge-tile');
        if (gostergeElement && this.gameState.gosterge) {
            gostergeElement.innerHTML = '';
            const tileElement = this.createTileElement(this.gameState.gosterge);
            tileElement.classList.add('gosterge');
            gostergeElement.appendChild(tileElement);
        }
    }

    drawFromDiscardPile(tile) {
        if (this.gameState.currentTurn !== this.user.id) {
            this.showNotification('Sıranız değil!', 'warning');
            return;
        }

        console.log('🎯 Drawing from discard pile:', tile);
        
        if (this.socket && this.socket.connected) {
            this.socket.emit('drawFromDiscard', {
                gameId: this.gameState.id,
                tileId: tile.id
            });
        } else {
            // Mock local action
            this.gameState.players.find(p => p.id === this.user.id).hand.push(tile);
            this.gameState.discardPile.pop();
            this.renderPlayerHand();
            this.updateDiscardPile();
        }
    }

    updateTurnControls() {
        const isMyTurn = this.isMyTurn || (this.gameState && this.gameState.currentPlayer === this.user.id);
        
        // Update action buttons visibility
        const drawBtn = document.getElementById('drawFromPileBtn');
        const declareBtn = document.getElementById('declareWinBtn');
        const sortBtn = document.getElementById('sortHandBtn');
        
        if (drawBtn) drawBtn.disabled = !isMyTurn;
        if (declareBtn) declareBtn.disabled = !isMyTurn;
        if (sortBtn) sortBtn.disabled = false; // Sorting is always allowed
        
        // Update turn indicator
        const turnIndicator = document.getElementById('currentPlayerIndicator');
        if (turnIndicator) {
            turnIndicator.textContent = isMyTurn ? 'Ihr Zug!' : 'Warten...';
            turnIndicator.className = isMyTurn ? 'my-turn' : 'waiting';
        }
        
        console.log('🔄 Turn controls updated:', { isMyTurn });
    }

    showGameControls() {
        // Show game action buttons
        const gameActions = document.querySelector('.game-actions');
        if (gameActions) {
            gameActions.style.display = 'flex';
        }
        
        // Hide start game button, show game controls
        const startBtn = document.getElementById('startGameBtn');
        if (startBtn) {
            startBtn.style.display = 'none';
        }
    }

    getColorSymbol(color) {
        const symbols = {
            'red': '♦',
            'blue': '♣', 
            'yellow': '♠',
            'black': '♥'
        };
        return symbols[color] || '?';
    }

    drawTile() {
        if (!this.isMyTurn) {
            this.showNotification('Nicht Ihr Zug!', 'warning');
            return;
        }

        console.log('🎯 Drawing tile from deck...');
        
        if (this.socket && this.socket.connected) {
            this.socket.emit('drawTile', {
                gameId: this.gameState.id,
                playerId: this.user.id
            });
        } else {
            // Mock tile draw
            const newTile = this.generateRandomTile();
            this.playerHand.push(newTile);
            this.renderPlayerHand();
            this.showNotification('Stein gezogen!', 'success');
        }
    }

    generateRandomTile() {
        const colors = ['red', 'black', 'blue', 'yellow'];
        return {
            id: `tile_${Date.now()}`,
            number: Math.floor(Math.random() * 13) + 1,
            color: colors[Math.floor(Math.random() * colors.length)],
            isOkey: false,
            isFakeOkey: false
        };
    }

    discardTile() {
        if (!this.selectedTile) {
            this.showNotification('Wählen Sie zuerst einen Stein aus!', 'warning');
            return;
        }

        console.log('🎯 Discarding tile:', this.selectedTile);
        
        if (this.socket && this.socket.connected) {
            this.socket.emit('discardTile', {
                gameId: this.gameState.id,
                playerId: this.user.id,
                tileId: this.selectedTile.tile.id
            });
        } else {
            // Mock discard
            this.playerHand.splice(this.selectedTile.index, 1);
            this.selectedTile = null;
            this.renderPlayerHand();
            this.showNotification('Stein abgelegt!', 'success');
        }
    }

    finishTurn() {
        if (this.socket && this.socket.connected) {
            this.socket.emit('finishTurn', {
                gameId: this.gameState.id,
                playerId: this.user.id
            });
        } else {
            this.isMyTurn = false;
            this.updateTurnControls();
            this.showNotification('Zug beendet!', 'info');
        }
    }

    declareWin() {
        console.log('🏆 Declaring win...');
        
        if (this.socket && this.socket.connected) {
            this.socket.emit('declareWin', {
                gameId: this.gameState.id,
                playerId: this.user.id,
                hand: this.playerHand
            });
        } else {
            this.showNotification('🏆 Okey! (Demo-Modus)', 'success');
        }
    }

    sortHand() {
        if (!this.playerHand || this.playerHand.length === 0) {
            this.showNotification('Keine Steine zum Sortieren!', 'warning');
            return;
        }

        console.log('📝 Sorting hand...');
        
        // Sort by color first, then by number
        this.playerHand.sort((a, b) => {
            const colorOrder = { 'red': 0, 'yellow': 1, 'blue': 2, 'black': 3 };
            if (a.color !== b.color) {
                return colorOrder[a.color] - colorOrder[b.color];
            }
            return a.number - b.number;
        });
        
        this.renderPlayerHand();
        this.showNotification('Hand sortiert!', 'info');
    }

    updateGameState(newGameState) {
        if (newGameState) {
            this.gameState = { ...this.gameState, ...newGameState };
            console.log('🔄 Game state updated:', this.gameState);
            
            // Update turn status
            this.isMyTurn = this.gameState.currentPlayer === this.user.id;
            this.updateTurnControls();
            
            // Update UI elements
            this.updateDeckCounter();
            this.updatePlayerPositions();
        }
    }
    
    // Fix the renderRooms function (it was calling displayRooms but not defined)
    renderRooms() {
        if (this.currentRooms) {
            this.displayRooms(this.currentRooms);
        }
    }

    // ...existing code...
}

// Initialize game client when page loads
let gameClient;
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Okey Game Client...');
    gameClient = new OkeyGameClient();
    
    // Make it globally accessible
    window.gameClient = gameClient;
    
    // Check for existing auth token
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
        console.log('🔑 Found existing auth token, attempting auto-login...');
        gameClient.socket.emit('authenticate', {
            token: authToken,
            isGuest: false
        });
    }
    
    console.log('✅ Okey Game Client initialized successfully!');
});

// Global functions for HTML onclick handlers
function showTab(tabName) {
    if (gameClient) {
        console.log('📋 Switching to tab:', tabName);
        if (tabName === 'register') {
            gameClient.showRegisterForm();
        } else if (tabName === 'login') {
            gameClient.showLoginForm();
        }
    }
}
