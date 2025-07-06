# 🎮 Okey Nostalji - Authentic Turkish Okey Game

Ein authentisches, multiplayer Okey-Spiel basierend auf den offiziellen türkischen Okey-Regeln. Entwickelt mit Node.js, Socket.io und modernem Frontend.

## 🎯 Features

### Authentische Okey-Spiellogik
- **106 Spielsteine**: 4 Farben × 13 Nummern × 2 Sets + 2 Sahte Okey
- **Gösterge-System**: Authentische Bestimmung der Okey-Steine
- **Multiple Gewinnbedingungen**: Normal, Çifte, Renkli, Sıralı Renk
- **Punktesystem**: Klassisches 20-Punkte-System mit authentischen Abzügen
- **Echtes Multiplayer**: 4 Spieler pro Tisch, Echtzeit-Synchronisation

### Moderne Technologie
- **Backend**: Node.js, Express, Socket.io
- **Frontend**: Vanilla JavaScript, CSS3, HTML5
- **Datenbank**: SQLite3 für Benutzer und Statistiken
- **Echtzeit**: WebSocket-basierte Kommunikation
- **Responsive**: Funktioniert auf Desktop und Mobile

## 🚀 Installation & Start

### Voraussetzungen
- Node.js (v14 oder höher)
- npm oder yarn

### Installation
```bash
# Repository klonen
git clone <repository-url>
cd Okey

# Dependencies installieren
npm install

# Umgebungsvariablen konfigurieren
cp .env.example .env
# Bearbeiten Sie .env nach Bedarf

# Server starten
npm start
```

### Entwicklungsmodus
```bash
# Mit Auto-Restart
npm run dev

# Nur Backend testen
node server.js
```

## 🎮 Spielanleitung

### Schnellstart
1. **Öffnen Sie** http://localhost:3000 in Ihrem Browser
2. **Klicken Sie** auf "⚡ Hızlı Başlat (Test)" für sofortigen Spielstart
3. **Oder wählen Sie**:
   - **Misafir Girişi**: Gastzugang ohne Registrierung
   - **Kayıt Ol**: Neues Konto erstellen
   - **Giriş Yap**: Mit bestehendem Konto einloggen

### Spielregeln (Authentisches Okey)

#### Grundlagen
- **4 Spieler** an einem Tisch
- **Gösterge-Stein** bestimmt die Okey-Steine (Joker)
- **Ziel**: 14 Steine in gültige Gruppen ordnen

#### Steinarten
- **Normale Steine**: 1-13 in 4 Farben (Rot, Gelb, Blau, Schwarz)
- **Okey-Steine**: Joker, bestimmt durch Gösterge
- **Sahte Okey**: 2 spezielle Joker-Steine

#### Gültige Gruppen
1. **Sequenz (Run)**: Mindestens 3 aufeinanderfolgende Nummern derselben Farbe
2. **Gruppe (Set)**: Mindestens 3 gleiche Nummern in verschiedenen Farben

#### Gewinnarten
- **Normal**: 14 Steine in gültigen Gruppen (1 Punkt Abzug für andere)
- **Çifte**: 7 Paare identischer Steine (2 Punkte Abzug)
- **Renkli**: Alle Steine derselben Farbe (8 Punkte Abzug)
- **Sıralı Renk**: Alle Steine 1-13 derselben Farbe (alle anderen auf 0)
- **Okeyli**: Gewinnen durch Abwerfen eines Okey-Steins (doppelte Punkte)

#### Punktesystem
- **Startpunkte**: 20 pro Spieler
- **Gewinner**: Behält Punkte, andere verlieren je nach Gewinnart
- **Spielende**: Wenn ein Spieler 0 Punkte erreicht

### Steuerung
- **Stein ziehen**: Deck oder Abwurfstapel anklicken
- **Stein abwerfen**: Stein auswählen und "Abwerfen" klicken
- **Hand sortieren**: "Sortieren"-Button verwenden
- **Gewinn erklären**: "Gewinnen"-Button → Gewinnart auswählen
- **Gösterge zeigen**: Falls vorhanden, für Bonuspunkte

## 🔧 Technische Details

### Projektstruktur
```
Okey/
├── server.js                 # Hauptserver
├── package.json             # Dependencies
├── .env                     # Umgebungsvariablen
├── public/                  # Frontend-Dateien
│   ├── index.html          # Haupt-HTML
│   ├── game.js             # Spiel-JavaScript
│   └── style.css           # Styling
└── src/                    # Backend-Code
    ├── game/
    │   ├── OkeyGame.js     # Hauptspiellogik
    │   └── GameManager.js  # Raum-/Tischverwaltung
    ├── AuthManager.js      # Authentifizierung
    └── DatabaseManager.js  # Datenbankoperationen
```

### Socket Events
```javascript
// Client → Server
'authenticate'    // Anmeldung
'getRooms'        // Räume laden
'joinTable'       // Tisch beitreten
'playerAction'    // Spielaktion
  ├── 'drawTile'      // Stein ziehen
  ├── 'discardTile'   // Stein abwerfen
  ├── 'declareWin'    // Gewinn erklären
  ├── 'sortHand'      // Hand sortieren
  └── 'showGosterge'  // Gösterge zeigen

// Server → Client
'authenticated'   // Anmeldung bestätigt
'joinedRoom'      // Raum beigetreten
'gameStarted'     // Spiel gestartet
'tileDrawn'       // Stein gezogen
'tileDiscarded'   // Stein abgeworfen
'turnChanged'     // Zug gewechselt
'gameEnded'       // Spiel beendet
```

### API Endpoints
```
POST /api/auth/register    # Registrierung
POST /api/auth/login       # Anmeldung
POST /api/auth/guest       # Gastzugang
GET  /api/leaderboard      # Bestenliste
```

## 🧪 Testing

### Automatisches Testen
```bash
# Quick Start Button verwenden
# → Erstellt automatisch Gastkonto
# → Fügt Demo-Spieler hinzu
# → Startet Spiel automatisch
```

### Manuelles Testen
1. **Mehrere Browser-Tabs** öffnen
2. **Verschiedene Accounts** erstellen
3. **Gleichen Tisch** beitreten
4. **Spiel starten** wenn 4 Spieler

### Demo-Modus
- **Offline-Funktionalität** für UI-Tests
- **Mock-Daten** für Entwicklung
- **Simulierte Spieler** für Einzeltest

## 🎨 Anpassung

### Farben & Styling
```css
:root {
    --primary: #1a472a;
    --secondary: #d4af37;
    /* Weitere Variablen in style.css */
}
```

### Spielregeln
```javascript
// In OkeyGame.js
this.startingScore = 20;  // Startpunkte
this.maxRounds = 10;      // Maximale Runden
// Weitere Einstellungen...
```

### Socket-Konfiguration
```javascript
// In server.js
const io = socketIo(server, {
    cors: { origin: "*" }
});
```

## 📱 Mobile Support

- **Responsive Design** für alle Bildschirmgrößen
- **Touch-optimiert** für mobile Geräte
- **Progressive Web App** Features

## 🔒 Sicherheit

- **Input-Validierung** auf Client und Server
- **Rate Limiting** für API-Endpoints
- **XSS-Protection** durch sanitization
- **CORS-Konfiguration** für Produktionsumgebung

## 🚀 Deployment

### Lokale Produktion
```bash
NODE_ENV=production npm start
```

### Docker (optional)
```bash
docker build -t okey-game .
docker run -p 3000:3000 okey-game
```

### Cloud-Deployment
- **Heroku**: Procfile vorhanden
- **DigitalOcean**: PM2-Configuration
- **AWS**: Environment-ready

## 🐛 Troubleshooting

### Häufige Probleme
1. **Port bereits belegt**: Ändern Sie PORT in .env
2. **Socket-Verbindung fehlschlägt**: Firewall prüfen
3. **Spiel startet nicht**: 4 Spieler erforderlich

### Debug-Modus
```bash
DEBUG=okey:* npm start  # Detaillierte Logs
```

### Browser-Console
```javascript
// Spiel-State anzeigen
console.log(window.gameClient.gameState);

// Socket-Events debuggen
window.gameClient.socket.onAny((event, data) => {
    console.log('Socket event:', event, data);
});
```

## 🤝 Contributing

1. **Fork** das Repository
2. **Feature Branch** erstellen
3. **Tests** hinzufügen/aktualisieren
4. **Pull Request** erstellen

### Entwicklungsrichtlinien
- **ESLint** für Code-Quality
- **Prettier** für Formatierung
- **JSDoc** für Dokumentation
- **Semantic Versioning** für Releases

## 📄 License

MIT License - siehe LICENSE.md für Details

## 👥 Credits

- **Spielregeln**: Basierend auf Wikipedia und türkischen Okey-Traditionen
- **Design-Inspiration**: Moderne Gaming-Interfaces
- **Technologie**: Node.js, Socket.io Community

## 📞 Support

- **Issues**: GitHub Issues verwenden
- **Diskussionen**: GitHub Discussions
- **Updates**: Watch Repository für Updates

---

**🎮 Viel Spaß beim Spielen! / İyi oyunlar!** 🇹🇷
