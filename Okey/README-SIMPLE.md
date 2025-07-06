# 🎮 Okey Game - Vereinfachtes Admin System

Ein modernes, vereinfachtes Okey-Spiel mit zentraler Admin-Verwaltung.

## ✨ Features

- **Einfache Verwaltung**: Ein zentraler Admin-Bereich für alle Funktionen
- **Echtes Okey-Spiel**: Authentische türkische Okey-Regeln
- **Multiplayer**: Bis zu 4 Spieler pro Raum
- **Guest Login**: Sofortiger Spielstart ohne Registrierung
- **Real-time**: Live-Updates über WebSocket
- **Responsive Design**: Funktioniert auf Desktop und Tablet

## 🚀 Schnellstart

### 1. Installation
```bash
npm install
```

### 2. Server starten
```bash
# Einfacher Start
./start-simple.sh

# Oder manuell
node unified-server.js
```

### 3. Zugriff
- **Spiel**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin

## 👨‍💼 Admin-Bereich

### Login-Daten
- **Benutzername**: `admin`
- **Passwort**: `admin123`

### Admin-Funktionen
- ✅ Spielräume erstellen und verwalten
- ✅ Live-Statistiken anzeigen
- ✅ Spieler-Übersicht
- ✅ Räume in Echtzeit überwachen
- ✅ Räume löschen (alle Spieler werden entfernt)

## 🎯 Spieler-Funktionen

### Für Spieler
1. **Guest Login**: Einfach einen Namen eingeben und loslegen
2. **Raum wählen**: Aus verfügbaren Räumen auswählen
3. **Mitspielen**: Automatisches Matching mit anderen Spielern
4. **Okey spielen**: Vollständiges Okey-Spiel mit allen Regeln

### Game Features
- ✅ Authentic Turkish Okey rules
- ✅ Tile shuffling and dealing
- ✅ Turn-based gameplay
- ✅ Win detection
- ✅ Real-time synchronization
- ✅ Drag & drop interface

## 🔧 Admin-Verwaltung

### Räume erstellen
1. Im Admin-Panel anmelden
2. "Neuen Spielraum erstellen" verwenden
3. Raumname und max. Spielerzahl festlegen
4. Raum wird sofort für Spieler verfügbar

### Überwachung
- **Live-Statistiken**: Anzahl Räume, aktive Spiele, Online-Spieler
- **Raum-Details**: Spielerstatus, Spielzustand pro Raum
- **Server-Info**: Laufzeit und Performance

### Raum-Management
- **Aktive Räume**: Übersicht aller Räume mit Status
- **Spieler-Info**: Wie viele Spieler in welchem Raum
- **Löschen**: Räume entfernen (Spieler werden benachrichtigt)

## 🏗️ Technische Architektur

### Vereinfachtes Design
```
Unified Server (Port 3000)
├── Public Game Interface (/)
├── Admin Panel (/admin)
├── REST API (/api/*)
└── WebSocket (Socket.io)
```

### Komponenten
- **unified-server.js**: Haupt-Server mit allem
- **admin-panel/admin.html**: Admin-Interface
- **public/**: Spiel-Frontend
- **src/game/**: Okey-Spiellogik

## 📁 Projektstruktur

```
Okey/
├── unified-server.js          # Haupt-Server
├── start-simple.sh           # Start-Script
├── admin-panel/
│   └── admin.html            # Admin Interface
├── public/
│   ├── index.html            # Spiel-Frontend
│   ├── game-simple.js        # Vereinfachte Game-Logic
│   └── style.css             # Styles
└── src/
    ├── game/
    │   ├── OkeyGame.js       # Okey-Spielregeln
    │   └── GameManager.js    # Spiel-Verwaltung
    ├── DatabaseManager.js    # DB-Verwaltung
    └── AuthManager.js        # Authentifizierung
```

## 🎮 Spielregeln (Okey)

### Grundlagen
- **Spieler**: 2-4 Spieler
- **Steine**: 106 Steine (4 Farben, Zahlen 1-13, 2x + Joker)
- **Ziel**: Als erster alle Steine in Gruppen/Reihen legen

### Gruppen
- **Set**: 3-4 gleiche Zahlen in verschiedenen Farben
- **Run**: 3+ aufeinanderfolgende Zahlen in gleicher Farbe
- **Okey**: Der bestimmte Joker-Stein für diese Runde

### Spielablauf
1. Steine mischen und verteilen (14 pro Spieler)
2. Okey-Stein bestimmen
3. Reihum: Stein ziehen → (optional) Gruppe/Reihe legen → Stein abwerfen
4. Gewinner: Erster mit allen Steinen in gültigen Kombinationen

## 🔧 Wartung

### Server stoppen
```bash
pkill -f "unified-server"
```

### Server neustarten
```bash
./start-simple.sh
```

### Logs anzeigen
```bash
# Server-Output in Echtzeit
tail -f /dev/stdout
```

## 📈 Monitoring

### Admin Dashboard zeigt:
- **Gesamt Räume**: Anzahl erstellter Räume
- **Aktive Spiele**: Laufende Spiele
- **Online Spieler**: Aktuell verbundene Spieler
- **Server Laufzeit**: Uptime in Minuten

### Raum-Status
- 🟢 **Verfügbar**: Raum hat freie Plätze
- 🟡 **Aktiv**: Spiel läuft
- 🔴 **Voll**: Keine freien Plätze

## 🚀 Erweiterte Features (Optional)

### Geplante Erweiterungen
- **Benutzer-Registrierung**: Persistente Accounts
- **Statistiken**: Spieler-Performance tracking
- **Tournaments**: Turniere und Ranglisten
- **Chat**: In-Game Kommunikation
- **Mobile App**: Native mobile Anwendung

## 🔒 Sicherheit

### Aktuelle Maßnahmen
- **Admin-Authentifizierung**: Login erforderlich für Admin-Panel
- **Input-Validierung**: Schutz vor ungültigen Daten
- **Error-Handling**: Robuste Fehlerbehandlung

### Produktions-Empfehlungen
- **HTTPS**: SSL-Zertifikat einrichten
- **Starke Passwörter**: Admin-Passwort ändern
- **Rate Limiting**: Schutz vor Spam/DoS
- **Logging**: Umfassendes Activity-Logging

## 📞 Support

### Bei Problemen
1. **Server-Logs**: Konsole auf Fehlermeldungen prüfen
2. **Browser-Konsole**: Entwickler-Tools für Frontend-Fehler
3. **Neustart**: `./start-simple.sh` ausführen

### Häufige Probleme
- **Port besetzt**: `pkill -f "unified-server"` und neustart
- **Admin Login**: Prüfe Username/Passwort (admin/admin123)
- **Verbindungsfehler**: Server-Status und Port 3000 prüfen

---

**🎮 Viel Spaß beim Okey spielen! 🎮**
