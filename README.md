# ⏰ Clock OnAir - Backend

Backend Node.js pour le système Clock OnAir de radio.

## 🚀 Fonctionnalités

### API REST
- `GET /health` - État du service
- `GET /api/nowplaying` - Musique en cours de diffusion
- `GET /api/ntp` - Synchronisation NTP
- `POST /api/nowplaying/:station` - Mise à jour Now Playing (TopStudio/Insider)

### WebSocket (`/ws`)
- **Chat studio** : Communication temps réel entre les techniciens
- **Monitoring** : Supervision du système (NTP, utilisateurs connectés, Now Playing)

### TCP Server (port 3500)
- Connexion pour Arduino/ESP32
- Authentification par token
- Contrôle des GPIO distants

## 📦 Installation

```bash
# Installer les dépendances
npm install

# Configurer (optionnel)
cp config.js config.local.js
nano config.local.js

# Démarrer
node server.js
```

## 🔧 Configuration

Voir `config.js` pour :
- Ports TCP/HTTP
- Token d'authentification Arduino
- Configuration MR18 (console audio)

## 🌐 Production

Le backend tourne sur le VPS via systemd et Nginx reverse proxy.

### Nginx
```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3000/api/;
}

location /ws {
    proxy_pass http://127.0.0.1:3000/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
}
```

## 📝 Développement

```bash
# Simuler des données Now Playing
./simulate.sh
./simulate-random.sh
```

## 🔗 Liens

- Frontend : https://github.com/abdelba7/CLOCKONAIR
- Site web : https://clock-onair.duckdns.org
