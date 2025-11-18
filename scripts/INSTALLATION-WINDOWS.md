# Installation NP Forwarder sur Windows

## 🎯 3 méthodes disponibles

### Méthode 1 : PowerShell (RECOMMANDÉE pour Windows)

**Avantages** : Simple, natif Windows, aucune installation

**Installation :**

1. **Télécharger le script**
   - Aller sur https://github.com/abdelba7/CLOCKONAIR
   - Cliquer sur `scripts/np-forwarder.ps1`
   - Cliquer sur "Raw" puis Ctrl+S pour sauvegarder

2. **Modifier le chemin du log** (si différent)
   - Ouvrir `np-forwarder.ps1` avec Notepad
   - Ligne 4 : vérifier le chemin du fichier log
   ```powershell
   $LogFile = "C:\Program Files (x86)\Radio France\TopStudioNowPlaying\log-status.txt"
   ```

3. **Lancer le script**
   - Clic droit sur `np-forwarder.ps1`
   - "Exécuter avec PowerShell"
   - ✅ Le script se lance et attend les nouvelles lignes

4. **Démarrage automatique** (optionnel)
   - Créer un fichier `start-np-forwarder.bat` :
   ```batch
   @echo off
   powershell.exe -ExecutionPolicy Bypass -File "C:\Chemin\Vers\np-forwarder.ps1"
   ```
   - Copier dans `shell:startup` (Win+R)

---

### Méthode 2 : WSL + Bash (pour utilisateurs avancés)

**Avantages** : Plus léger, plus rapide, plus fiable

**Prérequis** : Windows 10/11 avec WSL installé

#### A. Installer WSL (si pas déjà fait)

```powershell
# Ouvrir PowerShell en administrateur
wsl --install

# Redémarrer Windows
# Au redémarrage, créer un compte Linux
```

#### B. Télécharger le script

Dans WSL (Ubuntu) :
```bash
cd ~
git clone https://github.com/abdelba7/CLOCKONAIR.git
cd CLOCKONAIR/scripts
chmod +x np-forwarder.sh
```

#### C. Lancer le script

```bash
# Le disque C:\ est accessible via /mnt/c/
./np-forwarder.sh "/mnt/c/Program Files (x86)/Radio France/TopStudioNowPlaying/log-status.txt"
```

#### D. Démarrage automatique

Créer `start-np-forwarder-wsl.bat` :
```batch
@echo off
wsl -d Ubuntu bash -c "cd ~/CLOCKONAIR/scripts && ./np-forwarder.sh '/mnt/c/Program Files (x86)/Radio France/TopStudioNowPlaying/log-status.txt'"
```

Copier dans `shell:startup`

---

### Méthode 3 : Batch + WSL (hybride)

**Avantages** : Combine simplicité Windows + performance Bash

**Installation :**

1. Télécharger `np-forwarder-windows.bat`
2. Double-cliquer dessus
3. ✅ Le script détecte WSL et lance automatiquement la version bash

---

## 🔍 Vérification

### Le script fonctionne si vous voyez :

```
=== CLOCK ONAIR - NP FORWARDER ===
Log      : C:\Program Files (x86)\Radio France\TopStudioNowPlaying\log-status.txt
API      : https://clock-onair.duckdns.org/api/nowplaying/45a
------------------------------------

Monitoring du fichier...
En attente de nouvelles lignes 'Now Playing'...
```

### Quand un NP arrive :

```
================================================
Ligne détectée : [45A] 17/11/2025 10:18:30 > Now Playing : Titre - Artiste (160000)
  Station    : 45A
  Titre      : Titre
  Artiste    : Artiste
  Durée (ms) : 160000
  JSON : {"station":"45A","title":"Titre",...}
  → Envoi OK
  → Réponse : {"ok":true,"station":"45a",...}
```

---

## ❌ Dépannage

### Le script ne démarre pas

**Erreur : "Impossible d'exécuter"**
```powershell
# Solution : autoriser l'exécution
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Le fichier log n'existe pas

**Erreur : "ERREUR: Le fichier n'existe pas"**

1. Vérifier le chemin dans TopStudio
2. Modifier le chemin dans le script (ligne 4)
3. Relancer

### Pas de détection de lignes

**Le script tourne mais n'affiche rien**

- TopStudio génère-t-il des lignes "Now Playing" ?
- Ouvrir le fichier log avec Notepad pour vérifier
- Lancer un titre dans TopStudio pour tester

### Erreur de connexion

**Erreur : "ERREUR envoi API"**

- Vérifier la connexion Internet
- Tester : ouvrir https://clock-onair.duckdns.org dans un navigateur
- Vérifier le pare-feu Windows

---

## 📊 Comparaison des méthodes

| Critère | PowerShell | WSL Bash | Batch+WSL |
|---------|-----------|----------|-----------|
| Installation | ✅ Aucune | ⚠️ Installer WSL | ⚠️ Installer WSL |
| Simplicité | ✅✅✅ | ⚠️⚠️ | ✅✅ |
| Performance | ⚠️ Moyenne | ✅ Excellente | ✅ Excellente |
| Fiabilité | ✅ Bonne | ✅✅ Excellente | ✅✅ Excellente |
| RAM utilisée | ~50 MB | ~5 MB | ~5 MB |
| Recommandé pour | Setup simple | Production | Compromis |

---

## ✅ Choix rapide

- **Je veux simple et rapide** → PowerShell
- **Je veux performance** → WSL Bash
- **J'ai déjà WSL** → WSL Bash
- **Je ne sais pas quoi choisir** → PowerShell

---

## 📞 Support

Tout problème ? Vérifier :
1. Le chemin du fichier log est correct
2. TopStudio génère bien des lignes "Now Playing"
3. La connexion Internet fonctionne
4. Le site https://clock-onair.duckdns.org est accessible

Voir aussi :
- `README-NP-FORWARDER.md` - Guide PowerShell complet
- `README-NP-FORWARDER-BASH.md` - Guide Bash/WSL complet
- `CHOIX-VERSION-NP.md` - Comparaison détaillée
