#!/bin/bash

echo "🎮 Starte Okey Game mit vorbereiten Räumen..."

# Stoppe alte Prozesse
pkill -f "stable-server" > /dev/null 2>&1
sleep 2

# Starte Server im Hintergrund
echo "🚀 Starte Server..."
node stable-server.js &
SERVER_PID=$!

# Warte bis Server bereit ist
echo "⏳ Warte auf Server..."
sleep 3

# Erstelle Standard-Räume
echo "🏠 Erstelle Standard-Räume..."

curl -s -X POST http://localhost:3000/api/admin/rooms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer admin" \
  -d '{"name":"Anfänger Salon","maxPlayers":4}' > /dev/null

curl -s -X POST http://localhost:3000/api/admin/rooms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer admin" \
  -d '{"name":"Fortgeschrittene","maxPlayers":4}' > /dev/null

curl -s -X POST http://localhost:3000/api/admin/rooms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer admin" \
  -d '{"name":"Profi Salon","maxPlayers":4}' > /dev/null

curl -s -X POST http://localhost:3000/api/admin/rooms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer admin" \
  -d '{"name":"VIP Raum","maxPlayers":2}' > /dev/null

echo ""
echo "✅ Okey Game ist bereit!"
echo ""
echo "🎯 Spiel:        http://localhost:3000"
echo "📊 Admin Panel:  http://localhost:3000/admin"
echo ""
echo "Admin Login:"
echo "  Benutzername: admin"
echo "  Passwort:     admin123"
echo ""
echo "🎮 4 Räume wurden erstellt:"
echo "  - Anfänger Salon (4 Spieler)"
echo "  - Fortgeschrittene (4 Spieler)" 
echo "  - Profi Salon (4 Spieler)"
echo "  - VIP Raum (2 Spieler)"
echo ""
echo "🔧 Zum Stoppen: pkill -f 'stable-server'"
echo ""
