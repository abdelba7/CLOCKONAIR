# NP Forwarder - Guide de choix

## Deux versions disponibles

### 1. Version PowerShell (Windows natif)
📄 `scripts/np-forwarder.ps1`

**Avantages :**
- ✅ Fonctionne directement sur Windows (pas besoin de WSL)
- ✅ Simple à lancer : clic droit → "Exécuter avec PowerShell"
- ✅ Pas de dépendances à installer
- ✅ Intégration native Windows

**Inconvénients :**
- ❌ Windows uniquement
- ❌ Plus lourd en ressources

**Utilisation :**
```powershell
# Clic droit sur np-forwarder.ps1
# → "Exécuter avec PowerShell"

# Ou depuis PowerShell :
.\np-forwarder.ps1
```

### 2. Version Bash (Linux/Mac/WSL)
📄 `scripts/np-forwarder.sh`

**Avantages :**
- ✅ Plus léger et rapide
- ✅ Fonctionne sur Linux, Mac, WSL
- ✅ Redémarre automatiquement si le log est recréé (`tail -F`)
- ✅ Parfait pour serveur ou intégration systemd
- ✅ Gestion native UTF-8

**Inconvénients :**
- ❌ Nécessite WSL sur Windows
- ❌ Chemin de fichier différent sous WSL (`/mnt/c/...`)

**Utilisation :**
```bash
# Depuis Linux/Mac/WSL
./np-forwarder.sh /chemin/vers/log-status.txt

# Sur WSL (Windows)
./np-forwarder.sh "/mnt/c/Program Files (x86)/Radio France/TopStudioNowPlaying/log-status.txt"
```

## Recommandations

### Pour une machine Windows TopStudio dédiée
→ **Utilisez la version PowerShell** (`np-forwarder.ps1`)
- Plus simple à déployer
- Pas besoin d'installer WSL
- Configuration minimale

### Pour un serveur Linux ou setup avancé
→ **Utilisez la version Bash** (`np-forwarder.sh`)
- Plus fiable et léger
- Intégration systemd possible
- Redémarrage automatique

### Pour Windows avec WSL installé
→ **Au choix**, selon préférence
- PowerShell : plus simple
- Bash : plus performant

## Format de log supporté

Les deux versions supportent le même format :
```
[45A] 17/11/2025 10:18:30 > Now Playing : Titre - Artiste (160000) - 24 Mo
```

Extraction :
- **Station** : `45A`
- **Titre** : `Titre`
- **Artiste** : `Artiste`
- **Durée** : `160000` ms

## Tests

### Tester l'API
```bash
# Script de test inclus
./scripts/test-np-api.sh
```

### Tester le parsing
```bash
# Version bash avec fichier de test
./scripts/np-forwarder.sh scripts/test-log.txt

# Appuyer sur Ctrl+C après quelques secondes
```

## Logs et monitoring

Les deux versions affichent :
- ✅ Lignes détectées en temps réel
- ✅ Infos parsées (station, titre, artiste, durée)
- ✅ JSON envoyé
- ✅ Réponse de l'API
- ✅ Compteur de NP envoyés
- ✅ Affichage coloré

## Performance

| Critère | PowerShell | Bash |
|---------|-----------|------|
| RAM | ~50 MB | ~5 MB |
| CPU | Faible | Très faible |
| Latence | 100-200ms | 50-100ms |
| Fiabilité | Bonne | Excellente |

## Démarrage automatique

### PowerShell (Windows)
1. Créer un fichier `.bat` :
   ```batch
   @echo off
   powershell.exe -ExecutionPolicy Bypass -File "C:\chemin\np-forwarder.ps1"
   ```
2. Copier dans `shell:startup` (Win+R)

### Bash (Linux systemd)
1. Créer un service systemd
2. `systemctl enable clock-np-forwarder`

Voir `README-NP-FORWARDER-BASH.md` pour le détail.

## Choix rapide

**Question** : "Quelle version dois-je utiliser ?"

- Machine TopStudio Windows ? → **PowerShell**
- Serveur Linux ? → **Bash**
- Setup complexe / production ? → **Bash**
- Setup simple / test ? → **PowerShell**
- WSL déjà installé ? → **Bash** (plus performant)

## Support

Les deux versions sont maintenues et testées. Choisissez selon votre environnement !
