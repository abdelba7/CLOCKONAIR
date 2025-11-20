# Clock OnAir – XML TCP Forwarder

Ce script (`tcp-forwarder.ps1`) permet de capter le flux XML Now Playing émis en **TCP sur le port 8888** par la machine de diffusion, de filtrer les attributs utiles (Titre, Auteur, Intro, Outro, durée restante…) puis d'envoyer un **JSON léger** vers le backend Clock OnAir via HTTPS (port 443 exposé par Nginx).

Le backend peut ainsi alimenter :

- Le chrono du NP (grâce au `startTimestamp` transmis)
- Les infos NP (titre, artiste, intro/outro) affichées sur la page `clock.html`
- Les clients WebSocket monitoring/chat

---

## Prérequis

- Windows 10/11 avec PowerShell 5.1 (ou PowerShell 7.x)
- Accès réseau :
  - TCP entrant depuis la machine diffusion → `127.0.0.1:8888` ou l'IP locale réelle
  - HTTPS sortant vers `https://clock-onair.duckdns.org`
- Pare-feu autorisant la sortie HTTPS (port 443)

---

## Configuration

Les paramètres peuvent être ajustés de deux manières :

1. **En éditant les valeurs par défaut** en haut du script
2. **Via des variables d'environnement** (pratique pour un fichier `.bat`)

| Variable                | Par défaut                                      | Description                                             |
|-------------------------|-------------------------------------------------|---------------------------------------------------------|
| `CLOCK_XML_HOST`        | `10.156.209.57`                                 | IP/host qui émet le flux XML (défaut = ancienne config)|
| `CLOCK_XML_PORT`        | `8888`                                          | Port TCP d'écoute                                      |
| `CLOCK_STATION`         | `45a`                                           | Identifiant station (sert pour l'URL API)              |
| `CLOCK_API_BASE`        | `https://clock-onair.duckdns.org/api/nowplaying`| Base de l'API Node (terminaison `/station` ajoutée)    |
| `CLOCK_RECONNECT_DELAY` | `3`                                             | Délai (sec) avant reconnexion si coupure               |

---

## Lancement

```powershell
Set-Location C:\ClockOnAir\scripts
.\tcp-forwarder.ps1
```

Pour forcer un autre host/port/station :

```powershell
$env:CLOCK_XML_HOST = "10.10.10.50"
$env:CLOCK_STATION = "studio-b"
.\tcp-forwarder.ps1
```

---

## Fonctionnement

1. Connexion persistante au flux TCP → tamponne les octets reçus.
2. Extraction non bloquante des balises `<ONAIR ... />`.
3. Parsing des attributs :
   - `Title`, `Author`, `Remain`, `Intro`, `Outro`, `AirDate`, `Start`, `Channel`, `IDITEM`.
4. Calcul des métriques :
   - `durationMs = (now - start) + remain`
   - `elapsedMs = duration - remain`
   - `startTimestamp = AirDate + Start (ISO 8601)`
5. Envoi d'un JSON compressé à `https://clock-onair.duckdns.org/api/nowplaying/{station}`.
6. Une requête par nouveau `IDITEM` (évite le spam, latence < 1s).

---

## Vérifications

1. **Console PowerShell**
   - `[SRC]` indique les lignes détectées
   - `[API]` confirme les envois ou remonte l'erreur HTTP
2. **Backend**
   - `curl https://clock-onair.duckdns.org/api/nowplaying`
   - Ou la page monitoring (`clock.html`) doit afficher le titre courant
3. **Logs Node**
   - `pm2 logs` ou `journalctl` côté serveur si besoin

---

## Dépannage

| Problème                         | Pistes                                                            |
|---------------------------------|-------------------------------------------------------------------|
| Rien ne s'affiche en console    | Vérifier IP/port source (`sniffer-8888.ps1` peut aider)           |
| Erreur TLS/HTTPS                | Horloge Windows à jour, proxy d'entreprise, antivirus             |
| Chrono décalé                   | Confirmer que la machine diffusion donne bien `AirDate/Start` GMT |
| Trop de requêtes                | Le script n'envoie qu'à chaque nouveau `IDITEM` (1 par titre)     |
| Besoin d'autostart              | Créer un `.bat` dans `shell:startup` qui lance PowerShell avec le script |

---

## Fichier batch exemple

```bat
@echo off
set "CLOCK_XML_HOST=127.0.0.1"
set "CLOCK_STATION=45a"
powershell.exe -ExecutionPolicy Bypass -File "C:\ClockOnAir\scripts\tcp-forwarder.ps1"
```

Placez-le dans `shell:startup` pour lancer l'agent automatiquement.
