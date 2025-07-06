// Vereinfachte Okey Game Frontend Logic
class OkeyGameClient {
    constructor() {
        this.socket = null;
        this.user = null;
        this.currentRoom = null;
        this.gameState = null;
        this.playerHand = [];
        this.selectedTiles = [];
        this.isMyTurn = false;
        this.pendingRoomJoin = null; // Für automatischen Guest-Login vor Room-Beitritt
        
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

        this.socket.on('login_success', (data) => {
            console.log('🔐 Login successful:', data);
            this.user = data;
            this.showGameLobby();
            this.loadRooms();
            this.showNotification(`Willkommen, ${data.username}!`, 'success');
            
            // Falls ein Room-Beitritt ausstehend ist, führe ihn aus
            if (this.pendingRoomJoin) {
                console.log('🏠 Führe ausstehenden Room-Beitritt aus:', this.pendingRoomJoin);
                this.socket.emit('join_room', { roomId: this.pendingRoomJoin });
                this.pendingRoomJoin = null;
            }
        });

        this.socket.on('login_error', (data) => {
            console.log('❌ Login error:', data);
            this.showNotification(data.message, 'error');
        });

        this.socket.on('room_joined', (data) => {
            console.log('🏠 Room joined:', data);
            this.currentRoom = data.roomId;
            this.showGameTable(data);
            this.showNotification(`Raum "${data.roomName}" beigetreten (${data.playersCount}/4)`, 'success');
            
            // Update game status
            const gameStatusElement = document.getElementById('gameStatus');
            if (gameStatusElement) {
                if (data.playersCount >= 4) {
                    gameStatusElement.textContent = 'Spiel startet automatisch...';
                } else {
                    gameStatusElement.textContent = `Warte auf Spieler (${data.playersCount}/4)`;
                }
            }
        });

        this.socket.on('player_joined', (data) => {
            console.log('👤 Player joined:', data);
            this.showNotification(`${data.username} ist dem Raum beigetreten (${data.playersCount}/4)`, 'info');
            
            // Update game status
            const gameStatusElement = document.getElementById('gameStatus');
            if (gameStatusElement) {
                if (data.playersCount >= 4) {
                    gameStatusElement.textContent = 'Spiel startet automatisch...';
                } else {
                    gameStatusElement.textContent = `Warte auf Spieler (${data.playersCount}/4)`;
                }
            }
        });

        this.socket.on('player_left', (data) => {
            console.log('👤 Player left:', data);
            this.showNotification(`${data.username} hat den Raum verlassen`, 'info');
        });

        this.socket.on('room_closed', (data) => {
            console.log('🚪 Room closed:', data);
            this.showNotification(`Raum wurde geschlossen: ${data.reason}`, 'warning');
            this.backToRooms();
        });

        this.socket.on('game_started', (gameState) => {
            console.log('🎮 Game started:', gameState);
            this.gameState = gameState;
            this.updateGameState(gameState);
            this.showNotification('Spiel gestartet!', 'success');
        });

        this.socket.on('game_update', (gameState) => {
            console.log('🔄 Game update:', gameState);
            this.gameState = gameState;
            this.updateGameState(gameState);
        });

        this.socket.on('game_ended', (data) => {
            console.log('🏆 Game ended:', data);
            this.showNotification(`Spiel beendet! Gewinner: ${data.winner}`, 'success');
        });

        this.socket.on('error', (data) => {
            console.log('❌ Server error:', data);
            this.showNotification(data.message || 'Ein Fehler ist aufgetreten', 'error');
        });
    }

    setupEventListeners() {
        console.log('🔧 Setup Event Listeners...');
        
        // Login Form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
            console.log('✅ Login form listener hinzugefügt');
        } else {
            console.warn('⚠️ loginForm nicht gefunden');
        }

        // Guest Login Button
        const guestLoginBtn = document.getElementById('guestLoginBtn');
        if (guestLoginBtn) {
            guestLoginBtn.addEventListener('click', () => {
                console.log('👤 Guest Login Button geklickt');
                this.handleGuestLogin();
            });
            console.log('✅ Guest login button listener hinzugefügt');
        } else {
            console.warn('⚠️ guestLoginBtn nicht gefunden');
        }

        // Start Game Button
        const startGameBtn = document.getElementById('startGameBtn');
        if (startGameBtn) {
            startGameBtn.addEventListener('click', () => {
                this.startGame();
            });
            console.log('✅ Start game button listener hinzugefügt');
        } else {
            console.warn('⚠️ startGameBtn nicht gefunden');
        }

        // Back to Rooms Button
        const backToRoomsBtn = document.getElementById('backToRoomsBtn');
        if (backToRoomsBtn) {
            backToRoomsBtn.addEventListener('click', () => {
                this.backToRooms();
            });
            console.log('✅ Back to rooms button listener hinzugefügt');
        } else {
            console.warn('⚠️ backToRoomsBtn nicht gefunden');
        }

        // Quick Start Button (Test)
        const quickStartBtn = document.getElementById('quickStartBtn');
        if (quickStartBtn) {
            quickStartBtn.addEventListener('click', () => {
                console.log('⚡ Quick Start Button geklickt');
                this.quickDemo();
            });
            console.log('✅ Quick start button listener hinzugefügt');
        } else {
            console.warn('⚠️ quickStartBtn nicht gefunden');
        }
        
        console.log('🎯 Event Listeners Setup abgeschlossen');
    }

    setupDragAndDrop() {
        // Wird später implementiert für Tile-Bewegungen
        console.log('Drag & Drop Setup wird initialisiert...');
    }

    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!username || !password) {
            this.showNotification('Bitte Benutzername und Passwort eingeben', 'error');
            return;
        }

        // Für Demo: Einfach als Guest anmelden
        this.socket.emit('guest_login', { username });
    }

    async handleGuestLogin() {
        // Einfach einen zufälligen Guest-Namen generieren
        const username = 'Gast_' + Math.floor(Math.random() * 1000);
        console.log('Guest login attempt:', username);
        this.socket.emit('guest_login', { username });
    }

    quickDemo() {
        console.log('⚡ Quick Start gestartet...');
        const demoUsername = 'Demo_' + Math.floor(Math.random() * 1000);
        console.log('👤 Demo Login mit:', demoUsername);
        this.socket.emit('guest_login', { username: demoUsername });
    }

    quickStart() {
        console.log('⚡ Quick Start gestartet (aus HTML)...');
        this.quickDemo();
    }

    async loadRooms() {
        console.log('🏠 Lade verfügbare Räume...');
        console.log('🔍 Current URL:', window.location.href);
        
        try {
            console.log('📡 Sende Request an /api/rooms...');
            const response = await fetch('/api/rooms');
            console.log('📡 Response Status:', response.status, response.statusText);
            
            const rooms = await response.json();
            console.log('📋 Verfügbare Räume:', rooms);
            console.log('📊 Anzahl Räume:', rooms.length);
            
            this.displayRooms(rooms);
        } catch (error) {
            console.error('❌ Error loading rooms:', error);
            this.showNotification('Fehler beim Laden der Räume', 'error');
            
            // Fallback: Zeige Meldung dass Räume nicht geladen werden konnten
            const roomsGrid = document.getElementById('roomsGrid');
            if (roomsGrid) {
                roomsGrid.innerHTML = `
                    <div class="no-rooms">
                        <p>⚠️ Fehler beim Laden der Räume</p>
                        <p>Error: ${error.message}</p>
                        <button onclick="game.loadRooms()" class="btn btn-primary">Erneut versuchen</button>
                    </div>
                `;
            } else {
                console.error('❌ roomsGrid Element nicht gefunden für Fehler-Anzeige!');
            }
        }
    }

    displayRooms(rooms) {
        console.log('🎯 displayRooms gerufen mit', rooms.length, 'Räumen');
        
        const roomsGrid = document.getElementById('roomsGrid');
        if (!roomsGrid) {
            console.error('❌ roomsGrid Element nicht gefunden!');
            console.log('🔍 Verfügbare Elemente mit ID:');
            document.querySelectorAll('[id]').forEach(el => {
                console.log(`  - ${el.id}: ${el.tagName}`);
            });
            return;
        }

        console.log('✅ roomsGrid Element gefunden:', roomsGrid);
        console.log('🎯 Zeige Räume an:', rooms.length);

        if (rooms.length === 0) {
            const noRoomsHTML = `
                <div class="no-rooms">
                    <p>Keine Räume verfügbar</p>
                    <p>Ein Admin muss zuerst Räume erstellen.</p>
                    <button onclick="game.loadRooms()" class="btn btn-secondary">Aktualisieren</button>
                </div>
            `;
            console.log('📝 Setze "keine Räume" HTML:', noRoomsHTML);
            roomsGrid.innerHTML = noRoomsHTML;
            return;
        }

        const roomsHTML = rooms.map(room => `
            <div class="room-card ${room.canJoin ? '' : 'room-full'}" 
                 onclick="${room.canJoin ? `game.joinRoom('${room.id}')` : ''}">
                <div class="room-header">
                    <h3 class="room-name">${room.name}</h3>
                    <div class="room-status ${room.canJoin ? 'available' : 'full'}">
                        ${room.canJoin ? 'Verfügbar' : (room.currentPlayers >= room.maxPlayers ? 'Voll' : 'Spiel läuft')}
                    </div>
                </div>
                <div class="room-info">
                    <div class="players-count">
                        <i class="fas fa-users"></i>
                        ${room.currentPlayers}/${room.maxPlayers} Spieler
                    </div>
                </div>
                ${room.canJoin ? 
                    '<div class="room-action"><button class="join-btn">Beitreten</button></div>' :
                    '<div class="room-action"><button class="join-btn" disabled>Nicht verfügbar</button></div>'
                }
            </div>
        `).join('');
        
        // Füge einen Aktualisieren-Button hinzu
        const fullHTML = roomsHTML + `
            <div class="refresh-rooms">
                <button onclick="game.loadRooms()" class="btn btn-secondary">
                    <i class="fas fa-sync-alt"></i> Räume aktualisieren
                </button>
            </div>
        `;

        console.log('📝 Setze Räume HTML (Länge:', fullHTML.length, ')');
        console.log('📝 HTML Preview:', fullHTML.substring(0, 200) + '...');
        
        roomsGrid.innerHTML = fullHTML;
        
        console.log('✅ Räume erfolgreich angezeigt');
        console.log('🔍 roomsGrid nach Update:', roomsGrid.children.length, 'Kinder');
    }

    joinRoom(roomId) {
        if (!this.user) {
            // Automatischer Guest-Login vor dem Beitreten
            const guestUsername = 'Gast_' + Math.floor(Math.random() * 10000);
            console.log('🔐 Automatischer Guest-Login für Room-Beitritt:', guestUsername);
            
            // Speichere die Room-ID für nach dem Login
            this.pendingRoomJoin = roomId;
            this.socket.emit('guest_login', { username: guestUsername });
            return;
        }

        console.log('🏠 Joining room:', roomId);
        this.socket.emit('join_room', { roomId });
    }

    backToRooms() {
        if (this.currentRoom) {
            this.socket.emit('leave_room');
            this.currentRoom = null;
        }
        
        this.showGameLobby();
        this.loadRooms();
    }

    startGame() {
        if (!this.currentRoom) {
            this.showNotification('Nicht in einem Raum', 'error');
            return;
        }

        this.socket.emit('start_game');
    }

    showGameLobby() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('roomSelection').classList.remove('hidden');
        document.getElementById('gameScreen').classList.add('hidden');
        
        // Räume automatisch laden
        this.loadRooms();
    }

    showLoginScreen() {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('roomSelection').classList.add('hidden');
        document.getElementById('gameScreen').classList.add('hidden');
    }

    showGameTable(data) {
        document.getElementById('roomSelection').classList.add('hidden');
        document.getElementById('gameScreen').classList.remove('hidden');
        
        // Update room info
        const roomNameElement = document.getElementById('currentRoomName');
        if (roomNameElement) {
            roomNameElement.textContent = data.roomName || 'Unbekannter Raum';
        }

        // Update player count
        const playerCountElement = document.getElementById('currentPlayerCount');
        if (playerCountElement) {
            playerCountElement.textContent = `${data.playersCount || 1}/4 Spieler`;
        }
    }

    updateGameState(gameState) {
        if (!gameState) return;

        // Update game area - Wechsel zur Spiel-Ansicht
        document.getElementById('roomSelection').classList.add('hidden');
        document.getElementById('gameScreen').classList.remove('hidden');

        // Update player hand
        this.playerHand = gameState.playerHands ? gameState.playerHands[this.socket.id] : [];
        this.renderPlayerHand();

        // Update turn indicator
        this.isMyTurn = gameState.currentPlayer === this.socket.id;
        this.updateTurnIndicator();

        // Update game info
        this.updateGameInfo(gameState);
        
        // Update game status
        const gameStatusElement = document.getElementById('gameStatus');
        if (gameStatusElement) {
            gameStatusElement.textContent = 'Spiel läuft!';
        }
    }

    renderPlayerHand() {
        const handContainer = document.getElementById('playerHand');
        if (!handContainer || !this.playerHand) return;

        handContainer.innerHTML = this.playerHand.map((tile, index) => `
            <div class="tile ${this.selectedTiles.includes(index) ? 'selected' : ''}" 
                 data-index="${index}"
                 onclick="game.selectTile(${index})">
                <div class="tile-content">
                    ${this.getTileDisplay(tile)}
                </div>
            </div>
        `).join('');
    }

    getTileDisplay(tile) {
        if (!tile) return '';
        
        if (tile.isJoker) {
            return '<span class="joker">🃏</span>';
        }
        
        const colorClasses = {
            'red': 'tile-red',
            'blue': 'tile-blue',
            'green': 'tile-green',
            'yellow': 'tile-yellow'
        };
        
        return `<span class="${colorClasses[tile.color] || ''}">${tile.number}</span>`;
    }

    selectTile(index) {
        if (!this.isMyTurn) {
            this.showNotification('Nicht dein Zug!', 'warning');
            return;
        }

        const tileIndex = this.selectedTiles.indexOf(index);
        if (tileIndex > -1) {
            this.selectedTiles.splice(tileIndex, 1);
        } else {
            this.selectedTiles.push(index);
        }

        this.renderPlayerHand();
    }

    updateTurnIndicator() {
        const turnIndicator = document.getElementById('turnIndicator');
        if (turnIndicator) {
            turnIndicator.textContent = this.isMyTurn ? 'Dein Zug!' : 'Warte auf anderen Spieler...';
            turnIndicator.className = this.isMyTurn ? 'turn-indicator my-turn' : 'turn-indicator waiting';
        }
    }

    updateGameInfo(gameState) {
        // Update remaining tiles
        const remainingTiles = document.getElementById('remainingTiles');
        if (remainingTiles && gameState.remainingTiles !== undefined) {
            remainingTiles.textContent = gameState.remainingTiles;
        }

        // Update round info
        const roundInfo = document.getElementById('roundInfo');
        if (roundInfo && gameState.round !== undefined) {
            roundInfo.textContent = `Runde ${gameState.round}`;
        }
    }

    updateConnectionStatus(connected) {
        const statusIndicator = document.getElementById('connectionStatus');
        if (statusIndicator) {
            statusIndicator.className = connected ? 'connected' : 'disconnected';
            statusIndicator.textContent = connected ? 'Verbunden' : 'Getrennt';
        }
    }

    showNotification(message, type = 'info') {
        // Erstelle Notification Element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        // Füge zum Body hinzu
        document.body.appendChild(notification);

        // Auto-remove nach 5 Sekunden
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);

        console.log(`Notification [${type}]: ${message}`);
    }
}

// Initialize game when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 DOM geladen, initialisiere Okey Game Client...');
    game = new OkeyGameClient();
    window.game = game; // Für HTML-Zugriff
    window.gameClient = game; // Für HTML-Zugriff
    console.log('✅ Okey Game Client initialized');
    
    // Zuerst Login-Screen anzeigen
    game.showLoginScreen();
    
    // Debug-Funktion für Entwicklung
    window.debugGame = () => {
        console.log('🔍 Game Debug Info:');
        console.log('- Socket connected:', game.socket?.connected);
        console.log('- User:', game.user);
        console.log('- Current room:', game.currentRoom);
        
        // Test API direkt
        fetch('/api/rooms')
            .then(response => response.json())
            .then(rooms => {
                console.log('- Available rooms:', rooms.length);
                rooms.forEach(room => {
                    console.log(`  * ${room.name}: ${room.currentPlayers}/${room.maxPlayers} ${room.canJoin ? '✅' : '❌'}`);
                });
            })
            .catch(error => console.error('API Error:', error));
    };
    
    // Auto-Debug alle 5 Sekunden (nur für Development)
    if (window.location.hostname === 'localhost') {
        setInterval(() => {
            if (game.socket?.connected) {
                console.log('💓 Socket alive, user:', game.user?.username || 'not logged in');
            }
        }, 5000);
    }
});

// Add notification styles if not already present
if (!document.querySelector('#notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
            margin-bottom: 10px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease-out;
        }

        .notification-content {
            padding: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .notification-success {
            background: #d4edda;
            border-left: 4px solid #28a745;
            color: #155724;
        }

        .notification-error {
            background: #f8d7da;
            border-left: 4px solid #dc3545;
            color: #721c24;
        }

        .notification-warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            color: #856404;
        }

        .notification-info {
            background: #d1ecf1;
            border-left: 4px solid #17a2b8;
            color: #0c5460;
        }

        .notification-close {
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            padding: 0;
            margin-left: 10px;
            opacity: 0.7;
        }

        .notification-close:hover {
            opacity: 1;
        }

        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        .no-rooms {
            text-align: center;
            padding: 40px;
            color: #666;
        }

        .room-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: all 0.3s;
        }

        .room-card:hover {
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            transform: translateY(-2px);
        }

        .room-card.room-full {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .room-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .room-name {
            margin: 0;
            color: #333;
        }

        .room-status.available {
            color: #28a745;
            font-weight: bold;
        }

        .room-status.full {
            color: #dc3545;
            font-weight: bold;
        }

        .join-btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
        }

        .join-btn:disabled {
            background: #6c757d;
            cursor: not-allowed;
        }

        .refresh-rooms {
            text-align: center;
            margin-top: 20px;
            padding: 20px;
            border-top: 1px solid #eee;
        }

        .refresh-rooms button {
            background: #6c757d;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
        }

        .refresh-rooms button:hover {
            background: #5a6268;
        }
    `;
    document.head.appendChild(style);
}
