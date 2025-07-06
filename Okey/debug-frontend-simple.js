// Debug Frontend - Teste Room Loading direkt
const puppeteer = require('puppeteer');

async function debugFrontend() {
    console.log('🔍 Starte Frontend Debug...');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        devtools: true,
        args: ['--no-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Erfasse alle Console-Logs
    page.on('console', msg => {
        console.log(`🖥️  [${msg.type()}]`, msg.text());
    });
    
    // Erfasse Fehler
    page.on('pageerror', err => {
        console.log('❌ PAGE ERROR:', err.message);
    });
    
    // Erfasse Request-Fehler
    page.on('requestfailed', req => {
        console.log('❌ REQUEST FAILED:', req.url(), req.failure().errorText);
    });
    
    try {
        console.log('📖 Lade Seite...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
        
        // Warte 3 Sekunden
        await page.waitForTimeout(3000);
        
        // Prüfe ob roomsGrid Element existiert
        const roomsGridExists = await page.$('#roomsGrid') !== null;
        console.log('🏠 roomsGrid Element existiert:', roomsGridExists);
        
        if (roomsGridExists) {
            const roomsContent = await page.evaluate(() => {
                const grid = document.getElementById('roomsGrid');
                return {
                    innerHTML: grid.innerHTML,
                    children: grid.children.length
                };
            });
            console.log('📋 roomsGrid Inhalt:', roomsContent);
        }
        
        // Prüfe ob game object existiert
        const gameExists = await page.evaluate(() => typeof window.game !== 'undefined');
        console.log('🎮 Game Object existiert:', gameExists);
        
        if (gameExists) {
            const gameState = await page.evaluate(() => ({
                socketConnected: window.game.socket?.connected,
                user: window.game.user,
                currentRoom: window.game.currentRoom
            }));
            console.log('🎯 Game State:', gameState);
        }
        
        // Teste loadRooms direkt
        console.log('🔄 Teste loadRooms direkt...');
        await page.evaluate(() => {
            if (window.game && typeof window.game.loadRooms === 'function') {
                window.game.loadRooms();
            }
        });
        
        // Warte noch 2 Sekunden
        await page.waitForTimeout(2000);
        
        // Prüfe erneut den Inhalt
        if (roomsGridExists) {
            const roomsContentAfter = await page.evaluate(() => {
                const grid = document.getElementById('roomsGrid');
                return {
                    innerHTML: grid.innerHTML,
                    children: grid.children.length
                };
            });
            console.log('📋 roomsGrid Inhalt nach loadRooms:', roomsContentAfter);
        }
        
    } catch (error) {
        console.error('❌ Fehler:', error);
    }
    
    console.log('✅ Debug abgeschlossen. Browser bleibt offen...');
    // Browser nicht schließen für manuelle Inspektion
    // await browser.close();
}

debugFrontend().catch(console.error);
