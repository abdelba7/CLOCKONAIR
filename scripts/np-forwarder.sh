#!/bin/bash

# === CLOCK ONAIR - NP FORWARDER (Bash version) ===
# Script pour monitorer log-status.txt et envoyer les infos NP à l'API en temps réel

# Configuration
LOG_FILE="${1:-log-status.txt}"
API_URL="https://clock-onair.duckdns.org/api/nowplaying/45a"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

echo -e "${CYAN}=== CLOCK ONAIR - NP FORWARDER ===${NC}"
echo -e "Log      : ${LOG_FILE}"
echo -e "API      : ${API_URL}"
echo -e "------------------------------------"
echo ""

# Vérifier que le fichier existe
if [ ! -f "$LOG_FILE" ]; then
    echo -e "${RED}ERREUR: Le fichier n'existe pas : ${LOG_FILE}${NC}"
    echo "Usage: $0 [chemin/vers/log-status.txt]"
    exit 1
fi

echo -e "${GREEN}Monitoring du fichier...${NC}"
echo -e "${YELLOW}En attente de nouvelles lignes 'Now Playing'...${NC}"
echo ""

# Pattern regex pour extraire les infos
# Format: [45A] 17/11/2025 10:18:30 > Now Playing : Titre - Artiste (160000) - 24 Mo
PATTERN='^\[([^]]+)\][[:space:]]+[0-9]{2}/[0-9]{2}/[0-9]{4}[[:space:]]+[0-9]{2}:[0-9]{2}:[0-9]{2}[[:space:]]+>[[:space:]]+Now Playing[[:space:]]*:[[:space:]]*(.+)[[:space:]]*-[[:space:]]*([^(]+)[[:space:]]*\(([0-9]+)\)'

# Fonction pour envoyer le NP à l'API
send_np() {
    local station="$1"
    local title="$2"
    local artist="$3"
    local duration_ms="$4"
    local timestamp="$5"
    
    # Nettoyer les espaces
    station=$(echo "$station" | xargs)
    title=$(echo "$title" | xargs)
    artist=$(echo "$artist" | xargs)
    
    # Construire le JSON
    local json_payload=$(cat <<EOF
{
  "station": "${station}",
  "title": "${title}",
  "artist": "${artist}",
  "durationMs": ${duration_ms},
  "source": "TopStudioNowPlaying",
  "timestamp": "${timestamp}"
}
EOF
)
    
    echo -e "${GRAY}  JSON : $(echo "$json_payload" | tr -d '\n' | tr -s ' ')${NC}"
    
    # Envoyer à l'API
    local response=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json; charset=utf-8" \
        -d "$json_payload" \
        --max-time 5 \
        -w "\n%{http_code}")
    
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}  → Envoi OK${NC}"
        if [ -n "$body" ]; then
            echo -e "${GRAY}  → Réponse : ${body}${NC}"
        fi
    else
        echo -e "${RED}  → ERREUR HTTP ${http_code}${NC}"
        if [ -n "$body" ]; then
            echo -e "${RED}  → Détails : ${body}${NC}"
        fi
    fi
}

# Compteur pour statistiques
COUNT=0

# Lecture en temps réel du fichier (comme tail -f)
tail -n 0 -F "$LOG_FILE" 2>/dev/null | while IFS= read -r line; do
    # Ignorer les lignes vides
    [ -z "$line" ] && continue
    
    # Ne traiter que les lignes "Now Playing"
    if ! echo "$line" | grep -q "Now Playing"; then
        continue
    fi
    
    echo -e "${CYAN}================================================${NC}"
    echo -e "Ligne détectée : ${line}"
    
    # Extraire les informations avec grep et sed
    if echo "$line" | grep -qE '\[.+\].*Now Playing.*\([0-9]+\)'; then
        # Extraction des champs
        STATION=$(echo "$line" | grep -oP '^\[\K[^]]+')
        NP_PART=$(echo "$line" | grep -oP 'Now Playing\s*:\s*\K.+')
        TITLE=$(echo "$NP_PART" | sed -E 's/\s*-\s*.*//' | xargs)
        ARTIST=$(echo "$NP_PART" | sed -E 's/.*-\s+([^(]+)\s*\(.*/\1/' | xargs)
        DURATION=$(echo "$NP_PART" | grep -oP '\(\K[0-9]+')
        TIMESTAMP=$(date -Iseconds)
        
        echo -e "${GREEN}  Station    : ${STATION}${NC}"
        echo -e "${GREEN}  Titre      : ${TITLE}${NC}"
        echo -e "${GREEN}  Artiste    : ${ARTIST}${NC}"
        echo -e "${GREEN}  Durée (ms) : ${DURATION}${NC}"
        
        # Envoyer à l'API
        send_np "$STATION" "$TITLE" "$ARTIST" "$DURATION" "$TIMESTAMP"
        
        COUNT=$((COUNT + 1))
        echo -e "${BLUE}  Total envoyés : ${COUNT}${NC}"
    else
        echo -e "${YELLOW}  → Ligne ignorée (ne matche pas le pattern NP)${NC}"
    fi
    
    echo ""
done
