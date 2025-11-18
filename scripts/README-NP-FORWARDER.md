# Clock OnAir - Script NP Forwarder

## Installation

1. **Copier le script** `np-forwarder.ps1` sur la machine Windows qui génère les logs TopStudio

2. **Vérifier le chemin du log** dans le script (ligne 4) :
   ```powershell
   $LogFile = "C:\Program Files (x86)\Radio France\TopStudioNowPlaying\log-status.txt"
   ```

3. **Lancer le script** :
   - Clic droit sur `np-forwarder.ps1` → "Exécuter avec PowerShell"
   - Ou depuis PowerShell : `.\np-forwarder.ps1`

## Fonctionnement

Le script :
1. ✅ Lit le fichier de log en temps réel (tail -f)
2. ✅ Détecte les lignes "Now Playing"
3. ✅ Parse les informations (station, titre, artiste, durée)
4. ✅ Envoie **uniquement les données nécessaires** en JSON (pas tout le log)
5. ✅ Affiche le statut de chaque envoi (succès/erreur)

## Format de ligne attendu

```
[45A] 17/11/2025 13:00:03 > Now Playing : Titre - Artiste (83000) - 24 Mo
```

## Résolution de l'erreur 413

L'erreur 413 "Request Entity Too Large" était causée par :
- ❌ Envoi de tout le contenu du fichier log
- ✅ Solution : Envoyer uniquement un JSON léger (< 1 KB)

Le backend accepte jusqu'à 256 KB, et Nginx jusqu'à 1 MB, donc le JSON optimisé passe sans problème.

## Exemple de JSON envoyé

```json
{
  "station": "45A",
  "title": "Bohemian Rhapsody",
  "artist": "Queen",
  "durationMs": 354000,
  "source": "TopStudioNowPlaying"
}
```

## Démarrage automatique (optionnel)

Pour lancer le script au démarrage de Windows :

1. Créer un fichier `np-forwarder.bat` :
   ```batch
   @echo off
   powershell.exe -ExecutionPolicy Bypass -File "C:\chemin\vers\np-forwarder.ps1"
   ```

2. Ajouter le fichier `.bat` au démarrage :
   - `Win + R` → `shell:startup`
   - Copier le fichier `.bat` dans ce dossier

## Vérification

Une fois le script lancé :
1. Générer un événement "Now Playing" dans TopStudio
2. Vérifier la console PowerShell (affiche les envois)
3. Vérifier sur https://clock-onair.duckdns.org que le NP s'affiche

## Dépannage

### Le script ne détecte rien
- Vérifier que le fichier log existe
- Vérifier le format des lignes dans le log

### Erreur 413 persiste
- Vérifier que vous utilisez la **nouvelle version** du script
- Vérifier que le JSON envoyé est petit (< 1 KB)

### Erreur de connexion
- Vérifier que l'URL est accessible : https://clock-onair.duckdns.org
- Vérifier le firewall Windows

### Problème de caractères (accents)
- Le script utilise UTF-8, devrait fonctionner avec les accents français
