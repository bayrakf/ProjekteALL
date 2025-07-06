// Frontend Debug Test - simuliert kompletten Benutzer-Flow
const io = require('socket.io-client');

console.log('🔍 Frontend-Debugging gestartet...\n');

async function testCompleteFlow() {
    const socket = io('http://localhost:3000');
    
    // Step 1: Verbindung
    socket.on('connect', () => {
        console.log('✅ 1. Verbindung hergestellt (ID:', socket.id + ')');
        
        // Step 2: Guest Login (wie im Frontend)
        console.log('🔐 2. Teste Guest Login...');
        socket.emit('guest_login', { username: 'DebugUser' });
    });
    
    // Step 3: Login Response
    socket.on('login_success', async (data) => {
        console.log('✅ 3. Login erfolgreich:', data);
        
        // Step 4: API-Test (wie im Frontend JavaScript)
        console.log('📡 4. Teste API-Aufruf...');
        
        try {
            const fetch = (await import('node-fetch')).default;
            const response = await fetch('http://localhost:3000/api/rooms');
            const rooms = await response.json();
            
            console.log('✅ 5. API-Response erhalten:');
            console.log('   Anzahl Räume:', rooms.length);
            
            if (rooms.length === 0) {
                console.log('❌ PROBLEM: Keine Räume von API erhalten!');
            } else {
                console.log('✅ 6. Räume Details:');
                rooms.forEach((room, index) => {
                    console.log(`   ${index + 1}. ${room.name}`);
                    console.log(`      - ID: ${room.id}`);
                    console.log(`      - Spieler: ${room.currentPlayers}/${room.maxPlayers}`);
                    console.log(`      - Verfügbar: ${room.canJoin ? 'JA' : 'NEIN'}`);
                });
                
                // Step 7: Teste Raum-Beitritt (wähle einen verfügbaren Raum)
                const availableRoom = rooms.find(room => room.canJoin) || rooms[0];
                console.log(`\n🏠 7. Teste Raum-Beitritt: "${availableRoom.name}"`);
                socket.emit('join_room', { roomId: availableRoom.id });
            }
            
        } catch (error) {
            console.error('❌ API-Fehler:', error.message);
        }
    });
    
    socket.on('login_error', (data) => {
        console.error('❌ Login-Fehler:', data);
    });
    
    socket.on('room_joined', (data) => {
        console.log('✅ 8. Raum-Beitritt erfolgreich:', data);
        console.log('\n🎯 FRONTEND-TEST ERFOLGREICH ABGESCHLOSSEN!');
        process.exit(0);
    });
    
    socket.on('error', (data) => {
        console.error('❌ Socket-Fehler:', data);
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Verbindung getrennt');
    });
    
    // Timeout nach 10 Sekunden
    setTimeout(() => {
        console.log('⏰ Test-Timeout erreicht');
        process.exit(1);
    }, 10000);
}

testCompleteFlow();
