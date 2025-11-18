#!/bin/bash

# Script de démo pour simuler des ajouts au log en temps réel
# Permet de tester np-forwarder.sh sans attendre de vrais NP

DEMO_LOG="demo-log-realtime.txt"

echo "=== DEMO NP FORWARDER ==="
echo ""
echo "Ce script va créer un fichier log et y ajouter des lignes"
echo "Lancez dans un autre terminal :"
echo "  ./np-forwarder.sh $DEMO_LOG"
echo ""
read -p "Appuyez sur Entrée pour commencer..."

# Créer un fichier vide
> "$DEMO_LOG"
echo "Fichier $DEMO_LOG créé"

# Attendre un peu
sleep 2

# Ajouter des lignes progressivement
SONGS=(
    "[45A] 18/11/2025 17:35:00 > Now Playing : Bohemian Rhapsody - Queen (354000) - 24 Mo"
    "[45A] 18/11/2025 17:41:00 > Now Playing : Imagine - John Lennon (183000) - 24 Mo"
    "[45A] 18/11/2025 17:44:00 > Now Playing : Hotel California - Eagles (391000) - 24 Mo"
    "[45A] 18/11/2025 17:50:30 > Now Playing : Stairway to Heaven - Led Zeppelin (482000) - 24 Mo"
    "[45A] 18/11/2025 17:58:30 > Now Playing : Sweet Child O Mine - Guns N Roses (356000) - 24 Mo"
)

for song in "${SONGS[@]}"; do
    echo ""
    echo "➕ Ajout d'une ligne au log..."
    echo "$song" >> "$DEMO_LOG"
    echo "   Ligne ajoutée : $song"
    
    # Attendre entre 3 et 5 secondes
    sleep $((3 + RANDOM % 3))
done

echo ""
echo "=== FIN DE LA DEMO ==="
echo "Fichier $DEMO_LOG créé avec ${#SONGS[@]} entrées"
echo ""
echo "Pour nettoyer : rm $DEMO_LOG"
