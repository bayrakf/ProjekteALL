// Einfacher Test Client für direktes Room-Loading
const io = require('socket.io-client');

console.log('🧪 Teste Frontend Room Loading...');

// Test der API
console.log('📡 Teste API...');
const https = require('http');
const req = https.request('http://localhost:3000/api/rooms', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const rooms = JSON.parse(data);
            console.log('✅ API funktioniert, Räume:', rooms.length);
            rooms.forEach(room => {
                console.log(`  - ${room.name}: ${room.currentPlayers}/${room.maxPlayers} ${room.canJoin ? '✅' : '❌'}`);
            });
            
            // Teste Socket.io Connection
            testSocketConnection();
        } catch (e) {
            console.error('❌ API Fehler:', e);
        }
    });
});
req.on('error', (e) => console.error('❌ Request Fehler:', e));
req.end();

function testSocketConnection() {
    console.log('\n🔌 Teste Socket.io Verbindung...');
    
    const socket = io('http://localhost:3000');
    
    socket.on('connect', () => {
        console.log('✅ Socket verbunden:', socket.id);
        
        // Teste Guest Login
        const username = 'TestUser_' + Date.now();
        console.log('🔐 Teste Guest Login:', username);
        socket.emit('guest_login', { username });
    });
    
    socket.on('login_success', (data) => {
        console.log('✅ Login erfolgreich:', data.username);
        
        // Teste Room Listing (sollte nicht nötig sein, da API schon getestet)
        console.log('🏠 Socket Login erfolgreich - Frontend sollte jetzt Räume anzeigen können');
        
        setTimeout(() => {
            socket.disconnect();
            console.log('✅ Test abgeschlossen - alles funktioniert!');
            console.log('\n💡 Frontend-Problem ist wahrscheinlich:');
            console.log('   1. JavaScript lädt nicht korrekt');
            console.log('   2. setTimeout ist zu kurz');
            console.log('   3. Element-Selektoren funktionieren nicht');
            process.exit(0);
        }, 2000);
    });
    
    socket.on('login_error', (data) => {
        console.error('❌ Login Fehler:', data.message);
        socket.disconnect();
        process.exit(1);
    });
    
    socket.on('disconnect', () => {
        console.log('🔌 Socket getrennt');
    });
}
