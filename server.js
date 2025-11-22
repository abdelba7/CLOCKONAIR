'use strict';

/**
 * CLOCK ONAIR - Backend
 * ----------------------
 * - HTTP API (port 3000)
 *   - GET  /health
 *   - GET  /api/health
 *   - GET  /api/nowplaying
 *   - GET  /api/ntp
 *   - GET  /api/status
 *   - POST /api/nowplaying/:station   (TopStudio / Insider)
 *
 * - WebSocket (path /ws)
 *   - role "chat"       : chat studio + last message
 *   - role "monitoring" : monitoring NTP / NowPlaying / nb de clients
 *
 * - TCP Server (port 3500)
 *   - Auth par token pour Arduino (voir AUTH_TOKEN)
 *   - Messages JSON ligne par ligne ("\n")
 */

const http = require('http');
const net = require('net');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const ntpClient = require('ntp-client');
const path = require('path');
const WebSocket = require('ws');

const app = express();

// ---------------------------------------------------------------------
// CONFIG GLOBALE
// ---------------------------------------------------------------------
const HTTP_PORT = process.env.CLOCK_HTTP_PORT || 3000;
const TCP_PORT = process.env.CLOCK_TCP_PORT || 3500;

// Token utilisé dans le code Arduino (AUTH_TOKEN)
const AUTH_TOKEN =
  process.env.CLOCK_ARDUINO_TOKEN ||
  'f02165728b8c53f2dfe31f5a16a6a133981e1e7c49a7e98ee08ef608aea4058f';

// ---------------------------------------------------------------------
// ETAT GLOBAL
// ---------------------------------------------------------------------

// Date de démarrage du backend
const backendStartedAt = new Date();

// Dernier now playing reçu
// { station, payload, receivedAt }
let lastNowPlaying = null;

// Etat NTP
let ntpStatus = {
  synced: false,
  server: null,
  lastSync: null,
  offsetMs: 0,
  error: null
};

// Etat des devices connectés en TCP (Arduinos, etc.)
const devicesState = {}; // { deviceId: { lastSeen, remoteAddress, pins: {...} } }

// ---------------------------------------------------------------------
// INGEST TCP SERVER (Port 9000)
// ---------------------------------------------------------------------

const INGEST_PORT = process.env.CLOCK_INGEST_PORT || 9000;

function parseIngestTime(str) {
  if (!str) return 0;
  
  // Si c'est un nombre simple (ex: "3" pour 3 secondes)
  if (!str.includes(':')) {
    const num = parseInt(str, 10);
    return isNaN(num) ? 0 : num;
  }
  
  // Format HH:MM:SS
  const parts = str.split(':').map(Number);
  if (parts.length !== 3) return 0;
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function parseIngestDate(dateStr, timeStr) {
  if (!dateStr || dateStr.length !== 8) return new Date();
  const day = parseInt(dateStr.substring(0, 2), 10);
  const month = parseInt(dateStr.substring(2, 4), 10) - 1;
  const year = parseInt(dateStr.substring(4, 8), 10);
  
  const parts = timeStr.split(':').map(Number);
  
  const d = new Date(year, month, day, parts[0], parts[1], parts[2]);
  return d;
}

const ingestServer = net.createServer((socket) => {
  const remoteId = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[INGEST] Nouvelle connexion de ${remoteId}`);
  
  let buffer = '';

  socket.on('data', (data) => {
    buffer += data.toString();
    
    // On cherche les balises <ONAIR ... />
    const tagRegex = /<ONAIR\s+(.*?)(\/>|><\/ONAIR>)/g;
    let match;
    let lastIndex = 0;
    
    while ((match = tagRegex.exec(buffer)) !== null) {
      const content = match[1];
      lastIndex = tagRegex.lastIndex;
      
      // Extraction des attributs
      const attrs = {};
      const attrRegex = /(\w+)="([^"]*)"/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(content)) !== null) {
        attrs[attrMatch[1]] = attrMatch[2];
      }
      
      // Traitement
      if (attrs.Title) {
        const now = new Date();
        const startDate = parseIngestDate(attrs.AirDate, attrs.Start);
        const remainSec = parseIngestTime(attrs.Remain);
        const introSec = parseIngestTime(attrs.Intro);
        const outroSec = parseIngestTime(attrs.Outro);
        
        // Calculs
        const elapsedMs = now.getTime() - startDate.getTime();
        const durationMs = elapsedMs + (remainSec * 1000);
        
        lastNowPlaying = {
          station: 'default',
          receivedAt: startDate.toISOString(),
          payload: {
            title: attrs.Title,
            artist: attrs.Author,
            album: '', 
            durationMs: Math.max(0, durationMs),
            introMs: introSec * 1000,
            outroMs: outroSec * 1000,
            nextId: attrs.Next || '',
            // Debug
            _rawStart: attrs.Start,
            _rawRemain: attrs.Remain
          }
        };
        
        // Broadcast immédiat
        const frontNP = buildNowPlayingFront();
        if (frontNP) {
          broadcastMonitoring({ type: 'nowPlaying', nowPlaying: frontNP });
          broadcastChat({ type: 'nowPlaying', nowPlaying: frontNP });
        }
      }
    }
    
    if (lastIndex > 0) {
      buffer = buffer.substring(lastIndex);
    }
    
    if (buffer.length > 100000) {
       buffer = ''; 
    }
  });

  socket.on('error', (err) => {
    console.warn(`[INGEST] Erreur sur ${remoteId}:`, err.message);
  });

  socket.on('close', () => {
    console.log(`[INGEST] Déconnexion de ${remoteId}`);
  });
});

ingestServer.listen(INGEST_PORT, () => {
  console.log(`[CLOCK ONAIR] Serveur Ingest (XML) démarré sur le port ${INGEST_PORT}`);
});

// Liste des serveurs NTP : principale + secours
const NTP_SERVERS = [
  { host: 'ptbtime1.ptb.de', port: 123 },
  { host: 'ptbtime2.ptb.de', port: 123 },
  { host: 'pool.ntp.org',    port: 123 },
  { host: 'time.google.com', port: 123 }
];

// Etat pour WebSocket (chat & monitoring)
let chatHistory = []; // [{user, text, ts}]
const MAX_HISTORY = 20;

let wsClients = {
  chat: new Set(),        // clients WebSocket "chat"
  monitoring: new Set()   // clients WebSocket "monitoring"
};

// ---------------------------------------------------------------------
// FONCTIONS NTP
// ---------------------------------------------------------------------

function syncNtpOnce() {
  let index = 0;

  function tryNext() {
    if (index >= NTP_SERVERS.length) {
      ntpStatus.synced = false;
      ntpStatus.error = 'no-ntp-server-reachable';
      ntpStatus.lastSync = new Date();
      return;
    }

    const srv = NTP_SERVERS[index++];

    ntpClient.getNetworkTime(srv.host, srv.port, (err, date) => {
      if (err) {
        ntpStatus.synced = false;
        ntpStatus.server = srv.host;
        ntpStatus.error = err.message || String(err);
        ntpStatus.lastSync = new Date();
        return tryNext();
      }

      const localNow = new Date();
      ntpStatus.synced = true;
      ntpStatus.server = srv.host;
      ntpStatus.error = null;
      ntpStatus.lastSync = new Date();
      ntpStatus.offsetMs = date.getTime() - localNow.getTime();

      broadcastMonitoring({ type: 'ntp', ntp: ntpStatus });
    });
  }

  tryNext();
}

// Premier sync au démarrage + toutes les 60 secondes
syncNtpOnce();
setInterval(syncNtpOnce, 60 * 1000);

// Broadcast périodique des devices aux clients monitoring
setInterval(() => {
  if (wsClients.monitoring.size > 0) {
    const devicesArray = Object.keys(devicesState).map(deviceId => {
      const device = devicesState[deviceId];
      return {
        id: deviceId,
        lastSeen: device.lastSeen,
        remoteAddress: device.remoteAddress,
        pins: device.pins || {}
      };
    });
    
    broadcastMonitoring({
      type: 'devices',
      devices: devicesArray,
      ts: new Date().toISOString()
    });
  }
}, 3000); // Toutes les 3 secondes

// ---------------------------------------------------------------------
// EXPRESS APP (HTTP API)
// ---------------------------------------------------------------------

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(
  cors({
    origin: true,
    credentials: false
  })
);

app.use(morgan('tiny'));

app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: false }));

// Fichiers statiques du frontend (servi aussi par Node si besoin)
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------
// ENDPOINT DE DEBUG POUR NOW PLAYING
// ---------------------------------------------------------------------
app.all('/api/debug-nowplaying', (req, res) => {
  console.log('------------------------------');
  console.log('[DEBUG NOWPLAYING] Requête reçue à', new Date().toISOString());
  console.log('Method :', req.method);
  console.log('URL    :', req.originalUrl);
  console.log('Headers:', req.headers);
  console.log('Body   :', req.body);
  console.log('------------------------------');

  res.json({
    ok: true,
    debug: true,
    receivedAt: new Date().toISOString()
  });
});

// ---------------------------------------------------------------------
// HELPERS HEALTH & NOW PLAYING
// ---------------------------------------------------------------------

function buildHealthPayload() {
  return {
    ok: true,
    service: 'clock-onair-backend',
    startedAt: backendStartedAt.toISOString(),
    pid: process.pid,
    ntp: ntpStatus,
    nowPlaying: lastNowPlaying
      ? {
          station: lastNowPlaying.station,
          receivedAt: lastNowPlaying.receivedAt
        }
      : null,
    devices: {
      count: Object.keys(devicesState).length
    }
  };
}

function buildNowPlayingFront() {
  if (!lastNowPlaying) return null;
  const payload = lastNowPlaying.payload || {};

  const title =
    payload.title || payload.Title || payload.titre || '';
  const artist =
    payload.artist || payload.Artist || payload.auteur || '';
  const album =
    payload.album || payload.Album || payload.collection || '';
  
  // Utilisation directe des valeurs déjà calculées
  const durationMs = payload.durationMs || payload.DurationMs || payload.duree || 0;
  const introMs = payload.introMs || payload.IntroMs || 0;
  const outroMs = payload.outroMs || payload.OutroMs || 0;

  return {
    station: lastNowPlaying.station,
    receivedAt: lastNowPlaying.receivedAt,
    title,
    artist,
    album,
    durationMs: Math.max(0, durationMs),
    introMs,
    outroMs,
    payload: {
      ...payload,
      durationMs: Math.max(0, durationMs),
      introMs,
      outroMs
    }
  };
}

function parseDateCandidate(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const fromString = new Date(value);
    return Number.isNaN(fromString.getTime()) ? null : fromString;
  }

  return null;
}

function resolveReceivedAt(payload) {
  const candidates = [
    payload && payload.startTimestamp,
    payload && payload.startedAt,
    payload && payload.startTime,
    payload && payload.startDate,
    payload && payload.start
  ];

  for (const candidate of candidates) {
    const parsed = parseDateCandidate(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return new Date();
}

// ---------------------------------------------------------------------
// ROUTES HEALTH
// ---------------------------------------------------------------------

app.get('/health', (req, res) => {
  res.json(buildHealthPayload());
});

app.get('/api/health', (req, res) => {
  res.json(buildHealthPayload());
});

// ---------------------------------------------------------------------
// ROUTES NTP
// ---------------------------------------------------------------------

app.get('/api/ntp', (req, res) => {
  res.json(ntpStatus);
});

// ---------------------------------------------------------------------
// ROUTES NOW PLAYING
// ---------------------------------------------------------------------

app.post('/api/nowplaying/:station', (req, res) => {
  const station = (req.params.station || '').toLowerCase() || 'default';
  const payload = req.body && Object.keys(req.body).length ? req.body : {};
  const receivedAtDate = resolveReceivedAt(payload);

  // Détection nouveau titre : changement de titre ou pas de lastNowPlaying
  const isNewTitle = !lastNowPlaying || 
    (lastNowPlaying.payload && lastNowPlaying.payload.title !== payload.title);

  // Si c'est un nouveau titre, calculer durationMs
  if (isNewTitle) {
    if (!payload.durationMs && payload.remaining) {
      const remainingSec = typeof payload.remaining === 'number' 
        ? payload.remaining 
        : parseInt(payload.remaining, 10) || 0;
      const elapsedMs = Date.now() - receivedAtDate.getTime();
      payload.durationMs = elapsedMs + (remainingSec * 1000);
    }

    // Conversion intro/outro en ms si nécessaire
    if (!payload.introMs && payload.intro) {
      payload.introMs = (typeof payload.intro === 'number' ? payload.intro : parseInt(payload.intro, 10) || 0) * 1000;
    }
    if (!payload.outroMs && payload.outro) {
      payload.outroMs = (typeof payload.outro === 'number' ? payload.outro : parseInt(payload.outro, 10) || 0) * 1000;
    }
  } else {
    // Même titre : conserver les valeurs calculées précédemment
    payload.durationMs = lastNowPlaying.payload.durationMs;
    payload.introMs = lastNowPlaying.payload.introMs;
    payload.outroMs = lastNowPlaying.payload.outroMs;
  }

  lastNowPlaying = {
    station,
    payload,
    receivedAt: isNewTitle ? receivedAtDate.toISOString() : lastNowPlaying.receivedAt
  };

  const frontNP = buildNowPlayingFront();

  if (frontNP) {
    broadcastMonitoring({ type: 'nowPlaying', nowPlaying: frontNP });
    broadcastChat({ type: 'nowPlaying', nowPlaying: frontNP });
  }

  res.json({
    ok: true,
    station,
    receivedAt: lastNowPlaying.receivedAt
  });
});

app.get('/api/nowplaying', (req, res) => {
  if (!lastNowPlaying) {
    return res.json({
      ok: false,
      nowPlaying: null
    });
  }

  const frontNP = buildNowPlayingFront();

  res.json({
    ok: true,
    nowPlaying: frontNP
  });
});

// ---------------------------------------------------------------------
// ROUTE STATUS GLOBAL
// ---------------------------------------------------------------------

app.get('/api/status', (req, res) => {
  res.json({
    ntp: ntpStatus,
    nowPlaying: buildNowPlayingFront(),
    chatUsers: wsClients.chat.size,
    monitoringClients: wsClients.monitoring.size,
    devices: devicesState
  });
});

// ---------------------------------------------------------------------
// HTTP SERVER + WEBSOCKET
// ---------------------------------------------------------------------

const httpServer = http.createServer(app);

const wss = new WebSocket.Server({ server: httpServer, path: '/ws' });

wss.on('connection', (ws) => {
  ws.role = null;
  ws.user = null;

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // Hello = identification
    if (data.type === 'hello') {
      ws.role = data.role || 'chat';
      ws.user = data.user || 'Anonyme';

      if (ws.role === 'chat') {
        wsClients.chat.add(ws);

        ws.send(JSON.stringify({
          type: 'history',
          history: chatHistory
        }));

        broadcastChat({
          type: 'users',
          count: wsClients.chat.size
        });
      } else if (ws.role === 'monitoring') {
        wsClients.monitoring.add(ws);

        ws.send(JSON.stringify({
          type: 'status',
          ntp: ntpStatus,
          nowPlaying: buildNowPlayingFront(),
          chatUsers: wsClients.chat.size
        }));
      }
      return;
    }

    // Message de chat
    if (data.type === 'chat' && ws.role === 'chat') {
      const entry = {
        user: ws.user || 'Anonyme',
        text: data.text || '',
        ts: new Date().toISOString()
      };
      chatHistory.push(entry);
      if (chatHistory.length > MAX_HISTORY) {
        chatHistory.shift();
      }
      broadcastChat({
        type: 'chat',
        message: entry
      });
      return;
    }

    // TOP global (n'importe quel client peut l'envoyer, tout le monde le reçoit)
    if (data.type === 'top') {
      const topMsg = {
        type: 'top',
        studio: data.studio || null,
        active: !!data.active,
        fromUser: data.fromUser || ws.user || 'Anonyme',
        ts: new Date().toISOString()
      };
      broadcastChat(topMsg);
      broadcastMonitoring(topMsg);
      return;
    }

    // Configuration messages (ex: activer/désactiver ORDRES)
    if (data.type === 'config') {
      const channel = data.channel ? ` CH${data.channel}` : '';
      console.log(`[CONFIG] ${data.config}: ${data.enabled ? 'activé' : 'désactivé'}${channel}`);
      
      // Broadcast la config à tous les clients chat
      const configMsg = {
        type: 'config',
        config: data.config,
        enabled: !!data.enabled,
        channel: data.channel || 1,
        fromUser: ws.user || 'Anonyme',
        ts: new Date().toISOString()
      };
      broadcastChat(configMsg);
      
      return;
    }

    // ORDRES commands - sent to Arduino via TCP
    if (data.type === 'ordres') {
      const channel = data.channel || 1; // Canal du microphone (1-4)
      const active = !!data.active;
      
      console.log(`[ORDRES] Commande CH${channel}: ${active ? 'ON' : 'OFF'}`);
      
      // Envoyer la commande à tous les Arduinos connectés
      const ordresMsg = JSON.stringify({
        cmd: 'ordres',
        channel: channel,
        state: active ? 1 : 0
      }) + '\n';
      
      // Envoyer via TCP à tous les devices authentifiés
      for (const socket of tcpClients) {
        if (socket && socket.isAuthenticated && !socket.destroyed) {
          socket.write(ordresMsg);
        }
      }
      
      // Broadcast aux clients WebSocket pour synchronisation interface
      const broadcastMsg = {
        type: 'ordres',
        channel: channel,
        active: active,
        fromUser: ws.user || 'Anonyme',
        ts: new Date().toISOString()
      };
      broadcastChat(broadcastMsg);
      broadcastMonitoring(broadcastMsg);
      
      return;
    }
  });

  ws.on('close', () => {
    if (ws.role === 'chat') {
      wsClients.chat.delete(ws);
      broadcastChat({
        type: 'users',
        count: wsClients.chat.size
      });
    } else if (ws.role === 'monitoring') {
      wsClients.monitoring.delete(ws);
    }
  });
});

function broadcastChat(obj) {
  const json = JSON.stringify(obj);
  for (const client of wsClients.chat) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
}

function broadcastMonitoring(obj) {
  const json = JSON.stringify(obj);
  for (const client of wsClients.monitoring) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
}

httpServer.listen(HTTP_PORT, () => {
  console.log(`[CLOCK ONAIR] Backend HTTP démarré sur le port ${HTTP_PORT}`);
});

// ---------------------------------------------------------------------
// TCP SERVER (Arduino / devices)
// ---------------------------------------------------------------------

const tcpClients = new Set();

const tcpServer = net.createServer((socket) => {
  const remoteId = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[TCP] Nouvelle connexion depuis ${remoteId}`);

  socket.setEncoding('utf8');
  socket.isAuthenticated = false;
  socket.deviceId = remoteId;
  let buffer = '';
  
  tcpClients.add(socket);

  devicesState[socket.deviceId] = {
    lastSeen: new Date().toISOString(),
    remoteAddress: socket.remoteAddress,
    pins: {}
  };

  socket.on('data', (data) => {
    buffer += data.toString('utf8');

    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);

      if (!line) continue;
      handleTcpLine(socket, line);
    }
  });

  socket.on('error', (err) => {
    console.warn(`[TCP] Erreur sur ${remoteId}:`, err.message || err);
    tcpClients.delete(socket);
    delete devicesState[socket.deviceId];
  });

  socket.on('close', () => {
    console.log(`[TCP] Déconnexion de ${remoteId}`);
    tcpClients.delete(socket);
    delete devicesState[socket.deviceId];
  });
});

function handleTcpLine(socket, line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch (e) {
    console.warn('[TCP] JSON invalide reçu :', line);
    return;
  }

  if (msg.type === 'auth') {
    if (msg.token === AUTH_TOKEN) {
      socket.isAuthenticated = true;
      console.log('[TCP] Auth OK pour', socket.deviceId);
      socket.write(JSON.stringify({ type: 'auth_ok' }) + '\n');
    } else {
      console.warn('[TCP] Auth FAIL', socket.deviceId);
      socket.write(JSON.stringify({ type: 'auth_error' }) + '\n');
      socket.destroy();
    }
    return;
  }

  if (!socket.isAuthenticated) {
    console.warn('[TCP] Message non authentifié ignoré de', socket.deviceId);
    return;
  }

  if (msg.type === 'identify') {
    if (typeof msg.device === 'string' && msg.device.trim()) {
      socket.deviceId = msg.device.trim();
      console.log('[TCP] Device identifié comme', socket.deviceId);

      if (!devicesState[socket.deviceId]) {
        devicesState[socket.deviceId] = {
          lastSeen: new Date().toISOString(),
          remoteAddress: socket.remoteAddress,
          pins: {}
        };
      }
    }
    return;
  }

  if (msg.type === 'pins') {
    if (!devicesState[socket.deviceId]) {
      devicesState[socket.deviceId] = {
        lastSeen: new Date().toISOString(),
        remoteAddress: socket.remoteAddress,
        pins: {}
      };
    }

    devicesState[socket.deviceId].lastSeen = new Date().toISOString();
    devicesState[socket.deviceId].pins = {
      ...devicesState[socket.deviceId].pins,
      ...msg
    };

    return;
  }

  console.log('[TCP] Message reçu de', socket.deviceId, ':', msg);
}

tcpServer.listen(TCP_PORT, () => {
  console.log(`[CLOCK ONAIR] Serveur TCP pour Arduino démarré sur le port ${TCP_PORT}`);
});
