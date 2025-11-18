# Clock OnAir - NP Forwarder (Bash version)

## Description

Script bash pour monitorer `log-status.txt` en temps réel et envoyer automatiquement les informations "Now Playing" à l'API Clock OnAir.

Alternative à la version PowerShell, peut tourner sur Linux/Mac ou via WSL sur Windows.

## Installation

### Sur Linux/Mac ou WSL (Windows Subsystem for Linux)

```bash
# Rendre le script exécutable
chmod +x np-forwarder.sh

# Lancer le script
./np-forwarder.sh /chemin/vers/log-status.txt
```

### Sur Windows avec WSL

1. Installer WSL (Windows Subsystem for Linux) si pas déjà fait
2. Monter le dossier TopStudio dans WSL :
   ```bash
   # Le disque C:\ est accessible via /mnt/c/
   cd /mnt/c/Program\ Files\ \(x86\)/Radio\ France/TopStudioNowPlaying/
   ```

3. Lancer le script :
   ```bash
   /chemin/vers/np-forwarder.sh log-status.txt
   ```

## Format de ligne attendu

```
[45A] 17/11/2025 10:18:30 > Now Playing : Titre - Artiste (160000) - 24 Mo
```

Le script extrait :
- **Station** : `45A`
- **Titre** : `Titre`
- **Artiste** : `Artiste`
- **Durée** : `160000` ms (2m40s)
- **Timestamp** : Date/heure d'envoi

## Fonctionnement

1. ✅ Lecture en temps réel du fichier (`tail -F`)
2. ✅ Détection des lignes "Now Playing"
3. ✅ Parsing avec regex pour extraire les infos
4. ✅ Nettoyage des espaces
5. ✅ Construction du JSON
6. ✅ Envoi POST à l'API avec timeout 5s
7. ✅ Affichage coloré des résultats
8. ✅ Compteur de NP envoyés

## Avantages par rapport à PowerShell

- ✅ Plus léger en ressources
- ✅ Pas de dépendances externes
- ✅ Fonctionne sur Linux/Mac/WSL
- ✅ Redémarre automatiquement si le fichier est recréé (`tail -F`)
- ✅ Gestion native UTF-8

## Exemple d'affichage

```
=== CLOCK ONAIR - NP FORWARDER ===
Log      : log-status.txt
API      : https://clock-onair.duckdns.org/api/nowplaying/45a
------------------------------------

Monitoring du fichier...
En attente de nouvelles lignes 'Now Playing'...

================================================
Ligne détectée : [45A] 17/11/2025 10:18:30 > Now Playing : A nos actes manques - FREDERICKS GOLDMAN JONES (160000) - 24 Mo
  Station    : 45A
  Titre      : A nos actes manques
  Artiste    : FREDERICKS GOLDMAN JONES
  Durée (ms) : 160000
  JSON : {"station":"45A","title":"A nos actes manques","artist":"FREDERICKS GOLDMAN JONES","durationMs":160000,"source":"TopStudioNowPlaying"}
  → Envoi OK
  → Réponse : {"ok":true,"station":"45a","receivedAt":"2025-11-18T16:30:00.000Z"}
  Total envoyés : 1
```

## Démarrage automatique

### Sur Linux (systemd)

Créer `/etc/systemd/system/clock-np-forwarder.service` :

```ini
[Unit]
Description=Clock OnAir NP Forwarder
After=network.target

[Service]
Type=simple
User=topstudio
WorkingDirectory=/opt/topstudio
ExecStart=/opt/clock-onair/np-forwarder.sh /var/log/topstudio/log-status.txt
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Activer :
```bash
sudo systemctl daemon-reload
sudo systemctl enable clock-np-forwarder
sudo systemctl start clock-np-forwarder
sudo systemctl status clock-np-forwarder
```

### Sur Windows avec WSL

Créer un script `.bat` :
```batch
@echo off
wsl -d Ubuntu -u topstudio /home/topstudio/np-forwarder.sh "/mnt/c/Program Files (x86)/Radio France/TopStudioNowPlaying/log-status.txt"
```

Ajouter au démarrage de Windows.

## Dépannage

### Le script ne détecte rien
- Vérifier que le fichier existe
- Vérifier le format des lignes dans le log
- Tester avec `tail -f` pour voir si de nouvelles lignes arrivent

### Erreur de connexion
- Vérifier la connexion Internet
- Tester manuellement : `curl https://clock-onair.duckdns.org/api/health`

### Caractères bizarres (accents)
- Le script utilise UTF-8, devrait fonctionner
- Si problème, vérifier l'encodage du fichier log

## Arrêt du script

```bash
# Trouver le processus
ps aux | grep np-forwarder.sh

# Arrêter avec Ctrl+C ou kill
kill <PID>
```

## Logs

Le script affiche tout en temps réel. Pour logger dans un fichier :

```bash
./np-forwarder.sh log-status.txt 2>&1 | tee np-forwarder.log
```
