// Quick Test für Frontend-Debugging
const io = require('socket.io-client');

console.log('🧪 Teste Frontend-Funktionalität...\n');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log('✅ Verbunden mit Server');
    
    // Guest Login testen
    socket.emit('guest_login', { username: 'TestUser' });
});

socket.on('login_success', (data) => {
    console.log('🔐 Login erfolgreich:', data);
    
    // API-Test für verfügbare Räume
    console.log('\n📋 Teste API für Räume...');
    
    fetch('http://localhost:3000/api/rooms')
        .then(response => response.json())
        .then(rooms => {
            console.log('🏠 API-Antwort:', rooms);
            
            if (rooms.length > 0) {
                console.log('✅ Räume sind verfügbar!');
                rooms.forEach(room => {
                    console.log(`  - ${room.name}: ${room.currentPlayers}/${room.maxPlayers} ${room.canJoin ? '(Verfügbar)' : '(Nicht verfügbar)'}`);
                });
            } else {
                console.log('❌ Keine Räume gefunden');
            }
            
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ API-Fehler:', error);
            process.exit(1);
        });
});

socket.on('login_error', (data) => {
    console.error('❌ Login-Fehler:', data);
    process.exit(1);
});

// Import fetch dynamisch
async function loadFetch() {
    const { default: fetch } = await import('node-fetch');
    global.fetch = fetch;
}

loadFetch().catch(console.error);
