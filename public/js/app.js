// js/app.js

// --- util simple pour le nom d’utilisateur ---
function getUserName() {
  let name = localStorage.getItem('clockOnAirUser');
  if (!name) {
    name = prompt('Votre prénom / pseudo pour le chat ?') || 'Anonyme';
    localStorage.setItem('clockOnAirUser', name);
  }
  return name;
}

// --- horloge digitale NTP (client) ---
function startClock() {
  const el = document.getElementById('clock');
  if (!el) return;

  let offsetMs = 0; // si tu veux appliquer l’offset NTP

  // on récupère éventuellement l’offset NTP au chargement
  fetch('/api/ntp')
    .then((r) => r.json())
    .then((ntp) => {
      if (ntp && typeof ntp.offsetMs === 'number') {
        offsetMs = ntp.offsetMs;
      }
    })
    .catch(() => {});

  function tick() {
    const now = new Date(Date.now() + offsetMs);
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    el.textContent = `${h}:${m}:${s}`;
  }

  tick();
  setInterval(tick, 1000);
}

// --- WebSocket Chat + Last Message ---
let chatSocket = null;

function initChat() {
  const chatBtn = document.getElementById('chat-toggle');
  const chatPanel = document.getElementById('chat-panel');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatMessages = document.getElementById('chat-messages');
  const chatUsersBadge = document.getElementById('chat-users-count');
  const lastMessageEl = document.getElementById('last-message');

  if (!chatPanel || !chatForm) {
    return;
  }

  if (chatBtn) {
    chatBtn.addEventListener('click', () => {
      chatPanel.classList.toggle('open');
    });
  }

  const user = getUserName();
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  chatSocket = new WebSocket(`${protocol}://${window.location.host}/ws`);

  chatSocket.addEventListener('open', () => {
    chatSocket.send(JSON.stringify({
      type: 'hello',
      role: 'chat',
      user
    }));
  });

  chatSocket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'history') {
      chatMessages.innerHTML = '';
      data.history.forEach(addMessageToList);
      if (data.history.length > 0) {
        updateLastMessage(data.history[data.history.length - 1]);
      }
    }

    if (data.type === 'chat') {
      addMessageToList(data.message);
      updateLastMessage(data.message);
    }

    if (data.type === 'users' && chatUsersBadge) {
      chatUsersBadge.textContent = data.count;
    }

    if (data.type === 'nowPlaying') {
      updateNowPlayingDom(data.nowPlaying);
    }
  });

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text || !chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    chatSocket.send(JSON.stringify({
      type: 'chat',
      text
    }));
    chatInput.value = '';
  });

  function addMessageToList(msg) {
    const li = document.createElement('li');
    const time = msg.ts ? new Date(msg.ts) : new Date();
    const hh = String(time.getHours()).padStart(2, '0');
    const mm = String(time.getMinutes()).padStart(2, '0');

    li.innerHTML = `<span class="chat-time">[${hh}:${mm}]</span> <strong>${msg.user}</strong> ${msg.text}`;
    chatMessages.appendChild(li);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function updateLastMessage(msg) {
    if (!lastMessageEl) return;
    const time = msg.ts ? new Date(msg.ts) : new Date();
    const hh = String(time.getHours()).padStart(2, '0');
    const mm = String(time.getMinutes()).padStart(2, '0');
    lastMessageEl.textContent = `[${hh}:${mm}] ${msg.user} : ${msg.text}`;
  }
}

// --- Now Playing DOM simple ---
function updateNowPlayingDom(nowPlaying) {
  const npTitle = document.getElementById('np-title');
  const npArtist = document.getElementById('np-artist');
  const npAlbum = document.getElementById('np-album');
  if (!nowPlaying) return;
  if (npTitle) npTitle.textContent = nowPlaying.title || '';
  if (npArtist) npArtist.textContent = nowPlaying.artist || '';
  if (npAlbum) npAlbum.textContent = nowPlaying.album || '';
}

// --- Monitoring / Page tech ---
let monitoringSocket = null;

function initMonitoring() {
  const btn = document.getElementById('monitoring-toggle');
  const panel = document.getElementById('monitoring-panel');
  if (!btn || !panel) return;

  btn.addEventListener('click', () => {
    panel.classList.toggle('open');
  });

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  monitoringSocket = new WebSocket(`${protocol}://${window.location.host}/ws`);

  monitoringSocket.addEventListener('open', () => {
    monitoringSocket.send(JSON.stringify({
      type: 'hello',
      role: 'monitoring',
      user: getUserName()
    }));
  });

  monitoringSocket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'status') {
      updateMonitoringDom(data);
    }

    if (data.type === 'ntp') {
      updateMonitoringDom({ ntp: data.ntp });
    }

    if (data.type === 'nowPlaying') {
      updateMonitoringDom({ nowPlaying: data.nowPlaying });
    }
  });
}

function updateMonitoringDom(data) {
  const ntpEl = document.getElementById('mon-ntp');
  const npEl = document.getElementById('mon-nowplaying');
  const chatEl = document.getElementById('mon-chat-users');

  if (data.ntp && ntpEl) {
    ntpEl.innerHTML = `
      <div><strong>OK:</strong> ${data.ntp.ok}</div>
      <div><strong>Dernier sync:</strong> ${data.ntp.lastSync || '-'}</div>
      <div><strong>Offset:</strong> ${data.ntp.offsetMs != null ? data.ntp.offsetMs + ' ms' : '-'}</div>
      <div><strong>Serveur:</strong> ${data.ntp.serverTime || '-'}</div>
      <div><strong>Erreur:</strong> ${data.ntp.error || '-'}</div>
    `;
  }

  if (data.nowPlaying && npEl) {
    npEl.innerHTML = `
      <div><strong>Titre:</strong> ${data.nowPlaying.title || ''}</div>
      <div><strong>Artiste:</strong> ${data.nowPlaying.artist || ''}</div>
      <div><strong>Album:</strong> ${data.nowPlaying.album || ''}</div>
      <div><strong>Maj:</strong> ${data.nowPlaying.updatedAt || ''}</div>
      <div><strong>Erreur:</strong> ${data.nowPlaying.error || '-'}</div>
    `;
  }

  if (data.chatUsers != null && chatEl) {
    chatEl.textContent = data.chatUsers;
  }
}

// --- INITIALISATION GLOBALE ---
document.addEventListener('DOMContentLoaded', () => {
  startClock();
  initChat();
  initMonitoring();

  fetch('/api/nowplaying')
    .then((r) => r.json())
    .then(updateNowPlayingDom)
    .catch(() => {});
});
