# 🔍 Diagnostic : Pas de réception NP

## Résultat du diagnostic

✅ **Backend fonctionnel** : L'API fonctionne correctement  
✅ **Tests réussis** : Les données envoyées manuellement sont bien reçues et affichées  
❌ **Problème identifié** : Le script PowerShell n'envoie plus de données

## Cause du problème

Le backend **n'a pas reçu de nouveau Now Playing depuis 17:14:02**.

Derniers POST reçus :
- `17:14:02` - POST /api/nowplaying/45a 200
- Puis plus rien pendant 7+ minutes

## Solution

### Sur la machine Windows TopStudio :

1. **Vérifier que le script tourne**
   - Ouvrir le Gestionnaire des tâches
   - Rechercher `powershell.exe` avec `np-forwarder.ps1`

2. **Si le script ne tourne pas** : Le relancer
   ```
   Clic droit sur np-forwarder.ps1 → Exécuter avec PowerShell
   ```

3. **Vérifier le fichier log**
   - Chemin : `C:\Program Files (x86)\Radio France\TopStudioNowPlaying\log-status.txt`
   - S'assurer qu'il y a de nouvelles lignes "Now Playing"

4. **Regarder la console PowerShell**
   - Le script doit afficher en vert les lignes détectées
   - S'il n'affiche rien : pas de nouvelles lignes dans le log
   - S'il affiche des erreurs rouges : problème de connexion

## Test manuel de l'API

Pour vérifier que l'API fonctionne, depuis le VPS :

```bash
# Envoyer un NP de test
curl -X POST http://localhost:3000/api/nowplaying/45a \
  -H "Content-Type: application/json" \
  -d '{
    "station": "45A",
    "title": "Test Song",
    "artist": "Test Artist",
    "durationMs": 180000
  }'

# Vérifier la réception
curl http://localhost:3000/api/nowplaying | python3 -m json.tool
```

## Vérification sur le site

Après avoir relancé le script Windows :
1. Ouvrir https://clock-onair.duckdns.org
2. Vérifier que l'artiste et le titre s'affichent en bas
3. Vérifier que le ring NP progresse

## Délai normal

- **WebSocket** : instantané (~50-200ms)
- **Polling** : max 2 secondes
- **Première détection** : dépend du moment où une ligne "Now Playing" est écrite dans le log

## Script de test inclus

Un script de test est disponible : `scripts/test-np-api.sh`

```bash
cd ~/CLOCKONAIR/scripts
./test-np-api.sh
```

Ce script envoie un NP de test et vérifie qu'il est bien reçu.
