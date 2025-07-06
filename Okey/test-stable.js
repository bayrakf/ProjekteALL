// Einfacher Test-Client für Guest-Login und Spiel-Test
const io = require('socket.io-client');

class TestClient {
    constructor(username) {
        this.username = username;
        this.socket = null;
        this.currentRoom = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.socket = io('http://localhost:3000');
            
            this.socket.on('connect', () => {
                console.log(`✅ ${this.username} verbunden (ID: ${this.socket.id})`);
                resolve();
            });

            this.socket.on('disconnect', () => {
                console.log(`❌ ${this.username} getrennt`);
            });

            this.socket.on('login_success', (data) => {
                console.log(`🔐 ${this.username} Login erfolgreich:`, data);
            });

            this.socket.on('login_error', (data) => {
                console.log(`❌ ${this.username} Login-Fehler:`, data);
            });

            this.socket.on('room_joined', (data) => {
                console.log(`🏠 ${this.username} Raum beigetreten:`, data);
                this.currentRoom = data.roomId;
            });

            this.socket.on('player_joined', (data) => {
                console.log(`👤 ${this.username} Spieler beigetreten:`, data);
            });

            this.socket.on('player_left', (data) => {
                console.log(`👤 ${this.username} Spieler verlassen:`, data);
            });

            this.socket.on('game_started', (gameState) => {
                console.log(`🎮 ${this.username} Spiel gestartet!`);
            });

            this.socket.on('error', (data) => {
                console.log(`❌ ${this.username} Fehler:`, data);
            });
        });
    }

    async guestLogin() {
        return new Promise((resolve) => {
            this.socket.emit('guest_login', { username: this.username });
            setTimeout(resolve, 100); // Kurz warten
        });
    }

    async joinRoom(roomId) {
        return new Promise((resolve) => {
            this.socket.emit('join_room', { roomId });
            setTimeout(resolve, 100); // Kurz warten
        });
    }

    async startGame() {
        return new Promise((resolve) => {
            this.socket.emit('start_game');
            setTimeout(resolve, 100); // Kurz warten
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// Test ausführen
async function runTest() {
    console.log('🧪 Starte Okey-Spiel Test...\n');

    // Erstelle Test-Clients
    const clients = [
        new TestClient('TestSpieler1'),
        new TestClient('TestSpieler2'),
        new TestClient('TestSpieler3'),
        new TestClient('TestSpieler4')
    ];

    try {
        // 1. Alle Clients verbinden
        console.log('📡 Verbinde alle Test-Clients...');
        await Promise.all(clients.map(client => client.connect()));
        await new Promise(resolve => setTimeout(resolve, 500));

        // 2. Guest-Login für alle
        console.log('\n🔐 Guest-Login für alle Clients...');
        await Promise.all(clients.map(client => client.guestLogin()));
        await new Promise(resolve => setTimeout(resolve, 500));

        // 3. Dem bekannten Test-Raum beitreten
        console.log('\n🏠 Trete Test-Raum bei...');
        const testRoomId = 'room_1751833997578'; // Hauptraum

        // 4. Alle Clients dem Raum beitreten lassen
        console.log(`\n🎯 Alle Clients treten Test-Raum bei...`);
        
        for (let i = 0; i < clients.length; i++) {
            console.log(`👤 ${clients[i].username} tritt bei...`);
            await clients[i].joinRoom(testRoomId);
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // 5. Spiel starten (vom ersten Client)
        console.log('\n🎮 Starte Spiel...');
        await clients[0].startGame();
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('\n✅ Test abgeschlossen!');

    } catch (error) {
        console.error('❌ Test-Fehler:', error);
    } finally {
        // Alle Clients trennen
        console.log('\n🔌 Trenne alle Clients...');
        clients.forEach(client => client.disconnect());
    }
}

// Test starten
runTest();
