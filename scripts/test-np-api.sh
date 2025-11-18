#!/bin/bash
# Script de test pour l'API Now Playing

API_URL="https://clock-onair.duckdns.org/api/nowplaying/45a"

echo "=== TEST API NOW PLAYING ==="
echo "URL: $API_URL"
echo ""

# Test 1: Envoyer un NP de test
echo "1. Envoi d'un Now Playing de test..."
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "station": "45A",
    "title": "Test Song",
    "artist": "Test Artist",
    "durationMs": 180000,
    "source": "manual-test"
  }')

echo "   Réponse: $RESPONSE"
echo ""

# Test 2: Récupérer le NP
echo "2. Récupération du Now Playing..."
sleep 1
CURRENT=$(curl -s https://clock-onair.duckdns.org/api/nowplaying)
echo "   $CURRENT"
echo ""

# Test 3: Vérifier le payload
echo "3. Vérification des données..."
if echo "$CURRENT" | grep -q "Test Song"; then
    echo "   ✅ Le NP a bien été reçu et stocké"
else
    echo "   ❌ Le NP n'a pas été trouvé"
fi
echo ""

echo "=== FIN DU TEST ==="
