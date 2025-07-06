#!/bin/bash

# Vereinfachtes Okey Game System Starter
echo "🎮 Starte vereinfachtes Okey Game System..."

# Stoppe alte Prozesse
pkill -f "unified-server" > /dev/null 2>&1
pkill -f "simple-multi-tenant" > /dev/null 2>&1

# Warte kurz
sleep 2

# Starte neuen Server
echo "🚀 Starte Server auf Port 3000..."
node unified-server.js &

# Zeige Informationen
echo ""
echo "✅ Okey Game System gestartet!"
echo ""
echo "🎯 Spiel:        http://localhost:3000"
echo "📊 Admin Panel:  http://localhost:3000/admin"
echo ""
echo "Admin Login:"
echo "  Benutzername: admin"
echo "  Passwort:     admin123"
echo ""
echo "🔧 Zum Stoppen: pkill -f 'unified-server'"
echo ""
