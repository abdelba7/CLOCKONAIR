(function () {
  function byId(id) { return document.getElementById(id); }
  function pad2(n) { n = Math.floor(n); return (n < 10 ? "0" : "") + n; }
  function formatMMSS(totalSeconds) {
    totalSeconds = Math.max(0, Math.floor(totalSeconds));
    var m = pad2(Math.floor(totalSeconds / 60));
    var s = pad2(totalSeconds % 60);
    return m + ":" + s;
  }
  function nowHHMM() {
    var d = new Date();
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  window.addEventListener("DOMContentLoaded", function () {
    var body = document.body;

    /* ================== FAVICON DYNAMIQUE ==================== */
    var faviconLink = null;
    var faviconState = { onAir: false, connected: false };
    var faviconBaseSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128.5">
  <style>
    .s0{fill:#000000} .s1{fill:__C1__} .s2{fill:__C2__}
  </style>
  <g transform="translate(0,-0.9)">
    <path class="s1" d="M 64,129.4 C 28.6,129.4 0,100.7 0,65.1 0,29.6 28.6,0.9 64,0.9 c 35.4,0 64,28.7 64,64.2 0,35.6 -28.6,64.3 -64,64.3 z"/>
    <path class="s0" d="m 64,65.1 v 64.3 H 0 V 65.1 Z"/>
    <path class="s2" fill-rule="evenodd" d="M 63.9,129.4 H 64 V 65.1 H 0 c 0,35.5 28.6,64.2 63.9,64.3 z"/>
  </g>
</svg>`.trim();

    var faviconColors = {
      "default":   { c1: "#0064f5", c2: "#001ed2" },
      "onair":     { c1: "#ff5757", c2: "#b00000" },
      "connected": { c1: "#36ff9b", c2: "#019454" }
    };

    function ensureFaviconLink() {
      if (!faviconLink) {
        faviconLink = document.querySelector('link[rel="icon"]');
        if (!faviconLink) {
          faviconLink = document.createElement("link");
          faviconLink.rel = "icon";
          faviconLink.type = "image/svg+xml";
          document.head.appendChild(faviconLink);
        }
      }
      return faviconLink;
    }

    function refreshFavicon() {
      var mode = "default";
      if (faviconState.onAir) mode = "onair";
      else if (faviconState.connected) mode = "connected";

      var col = faviconColors[mode] || faviconColors["default"];
      var svg = faviconBaseSvg.replace(/__C1__/g, col.c1).replace(/__C2__/g, col.c2);
      ensureFaviconLink().href = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
    }

    function faviconSetOnAir(on) { faviconState.onAir = !!on; refreshFavicon(); }
    function faviconSetConnected(on) { faviconState.connected = !!on; refreshFavicon(); }

    /* ================== THÈME ==================== */
    try {
      var storedTheme = window.localStorage.getItem("clock_theme");
      if (storedTheme === "light") {
        body.classList.remove("theme-dark");
        body.classList.add("theme-light");
      } else {
        body.classList.remove("theme-light");
        body.classList.add("theme-dark");
      }
    } catch (e) {}
    body.classList.add("status-default");
    refreshFavicon();

    /* ================== USER / STUDIO (depuis index) ==================== */
    var userName = "Moi";
    var studio = "A";
    try {
      var storedName = window.localStorage.getItem("clock_user_name");
      if (storedName) userName = storedName;
      var storedStudio = window.localStorage.getItem("clock_user_studio");
      if (storedStudio) studio = storedStudio.toUpperCase();
    } catch (e) {}

    // Querystring studio override
    try {
      var params = new URLSearchParams(window.location.search || "");
      if (params.has("studio")) studio = (params.get("studio") || "A").toUpperCase();
    } catch (e) {}

    /* ================== BOUTON VEILLE (retour index) ==================== */
    var btnStandby = byId("btn-standby");
    if (btnStandby) {
      btnStandby.addEventListener("click", function (e) {
        if (e && e.preventDefault) e.preventDefault();
        window.location.href = "index.html";
      });
    }

    /* ================== HORLOGE / NP / NTP ==================== */
    var clockTimeEl = byId("clock-time");
    var onairLabelEl = byId("onair-label");
    var npPhaseLabelEl = byId("np-phase-label");
    var npChronoMainEl = byId("np-chrono-main");
    var npRingProgress = byId("np-ring-progress");
    var dotsLayer = byId("dots-layer");
    var headerOnAirChrono = byId("onair-chrono-header");

    var npArtistEl = byId("np-artist");
    var npTitleEl = byId("np-title");

    var currentNP = null;

    function applyNowPlaying(np) {
      if (!np || (!np.title && !np.artist)) {
        currentNP = null;
        if (npArtistEl) npArtistEl.textContent = " ";
        if (npTitleEl)  npTitleEl.textContent  = " ";
        return;
      }
      currentNP = np;
      if (!currentNP.receivedAt) currentNP.receivedAt = Date.now();
      else if (typeof currentNP.receivedAt === "string") {
        currentNP.receivedAt = new Date(currentNP.receivedAt).getTime();
      }
      if (npArtistEl) npArtistEl.textContent = np.artist || " ";
      if (npTitleEl)  npTitleEl.textContent  = np.title  || " ";
    }

    function fetchNowPlayingOnce() {
      fetch("/api/nowplaying")
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.ok && res.nowPlaying) applyNowPlaying(res.nowPlaying);
          else applyNowPlaying(null);
        })
        .catch(function () {});
    }
    fetchNowPlayingOnce();
    setInterval(fetchNowPlayingOnce, 10000);

    // NTP offset
    var clockOffsetMs = 0;
    fetch("/api/ntp")
      .then(function (r) { return r.json(); })
      .then(function (ntp) {
        if (ntp && typeof ntp.offsetMs === "number") clockOffsetMs = ntp.offsetMs;
      })
      .catch(function () {});

    // Points (60 sec)
    var DOT_COUNT = 60, DOT_RADIUS = 1.9, DOT_RING_RADIUS = 80;
    var dots = [];
    if (dotsLayer) {
      for (var d = 0; d < DOT_COUNT; d++) {
        var angle = (d / DOT_COUNT) * 2 * Math.PI - Math.PI / 2;
        var x = 100 + DOT_RING_RADIUS * Math.cos(angle);
        var y = 100 + DOT_RING_RADIUS * Math.sin(angle);
        var c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("class", "clock-dot");
        c.setAttribute("cx", x.toFixed(2));
        c.setAttribute("cy", y.toFixed(2));
        c.setAttribute("r", String(DOT_RADIUS));
        dotsLayer.appendChild(c);
        dots.push(c);
      }
    }

    // ON AIR local + TOP global
    var topBtn = byId("btn-top");
    var ordresBtn = byId("btn-ordres");
    var topSound = byId("top-sound");

    if (topSound) {
      var wakeAudio = function () {
        try {
          topSound.volume = 0;
          topSound.play().catch(function () {});
          setTimeout(function () {
            try { topSound.pause(); topSound.currentTime = 0; } catch (e) {}
          }, 40);
          topSound.volume = 1;
        } catch (e) {}
        window.removeEventListener("click", wakeAudio);
        window.removeEventListener("touchstart", wakeAudio);
      };
      window.addEventListener("click", wakeAudio, { once: true });
      window.addEventListener("touchstart", wakeAudio, { once: true });
    }

    var simOnAir = false;
    var onAirRunning = false;
    var onAirStart = Date.now();
    var onAirFrozenSec = 0;
    var topActive = false;

    function updateBackground() {
      body.classList.remove("status-default", "status-onair", "status-top");
      if (topActive) body.classList.add("status-top");
      else if (simOnAir) body.classList.add("status-onair");
      else body.classList.add("status-default");
    }

    function setOnAirState(active, resetChrono) {
      simOnAir = !!active;
      if (resetChrono) { onAirStart = Date.now(); onAirFrozenSec = 0; }
      if (simOnAir) {
        onAirStart = Date.now();
        onAirRunning = true;
        if (onairLabelEl) onairLabelEl.textContent = "ON AIR";
        if (ordresBtn) ordresBtn.classList.add("btn-active");
      } else {
        if (onAirRunning) onAirFrozenSec = (Date.now() - onAirStart) / 1000;
        onAirRunning = false;
        if (onairLabelEl) onairLabelEl.textContent = "";
        if (ordresBtn) ordresBtn.classList.remove("btn-active");
      }
      updateBackground();
      faviconSetOnAir(simOnAir);
    }
    setOnAirState(false);

    var lastSecond = null;
    function updateClock() {
      var now = new Date(Date.now() + clockOffsetMs);
      var sec = now.getSeconds();
      var hh = pad2(now.getHours()), mm = pad2(now.getMinutes()), ss = pad2(sec);

      if (clockTimeEl) clockTimeEl.textContent = hh + ":" + mm + ":" + ss;

      if (dots.length === DOT_COUNT && sec !== lastSecond) {
        if (sec === 0) dots.forEach(function (c) { c.classList.remove("active"); });
        if (dots[sec]) dots[sec].classList.add("active");
        lastSecond = sec;
      }

      var chronoSec = onAirRunning ? (Date.now() - onAirStart) / 1000 : onAirFrozenSec;
      if (headerOnAirChrono) headerOnAirChrono.textContent = formatMMSS(chronoSec);

      var display = "", ringFraction = 0;
      var rootStyle = window.getComputedStyle(document.documentElement);
      var ringColor = rootStyle.getPropertyValue("--np-green").trim() || "#23d56b";
      var npTextColor = ringColor, phaseText = "";

      if (!currentNP) {
        if (npPhaseLabelEl) npPhaseLabelEl.textContent = "";
        if (npChronoMainEl) npChronoMainEl.textContent = "";
        if (npRingProgress) {
          var R0 = 70, circ0 = 2 * Math.PI * R0;
          npRingProgress.style.strokeDasharray = circ0.toFixed(2);
          npRingProgress.style.strokeDashoffset = circ0.toFixed(2);
          npRingProgress.style.stroke = ringColor;
        }
      } else if (currentNP.receivedAt) {
        var nowTime = Date.now() + clockOffsetMs;
        var elapsed = (nowTime - currentNP.receivedAt) / 1000;
        if (elapsed < 0) elapsed = 0;

        var duration = (currentNP.durationMs || 0) / 1000;
        var intro = (currentNP.introMs || 0) / 1000;
        var outro = (currentNP.outroMs || 0) / 1000;

        if (duration > 0) {
          if (intro > 0 && elapsed < intro) {
            var remainIntro = intro - elapsed;
            display = formatMMSS(remainIntro);
            ringFraction = elapsed / intro;
            ringColor = rootStyle.getPropertyValue("--np-orange").trim() || "#ff9f0a";
            npTextColor = ringColor; phaseText = "INTRO";
          } else if (outro > 0 && elapsed > (duration - outro) && elapsed < duration) {
            var remainOutro = duration - elapsed;
            display = formatMMSS(remainOutro);
            ringFraction = (outro - remainOutro) / outro;
            ringColor = rootStyle.getPropertyValue("--np-orange").trim() || "#ff9f0a";
            npTextColor = ringColor; phaseText = "OUTRO";
          } else if (elapsed < duration) {
            var remainMain = duration - elapsed;
            display = formatMMSS(remainMain);
            ringFraction = elapsed / duration;
            ringColor = rootStyle.getPropertyValue("--np-green").trim() || "#23d56b";
            npTextColor = ringColor; phaseText = "";
          } else {
            display = ""; ringFraction = 1;
            ringColor = rootStyle.getPropertyValue("--text-muted").trim() || "#9c9ca4";
            npTextColor = ringColor; phaseText = "";
          }
        }
      }

      if (npPhaseLabelEl) npPhaseLabelEl.textContent = phaseText;
      if (npChronoMainEl) { npChronoMainEl.textContent = display; npChronoMainEl.style.color = npTextColor; }

      if (npRingProgress) {
        ringFraction = Math.min(1, Math.max(0, ringFraction));
        var R = 70, circumference = 2 * Math.PI * R;
        var offset = circumference * (1 - ringFraction);
        npRingProgress.style.strokeDasharray = circumference.toFixed(2);
        npRingProgress.style.strokeDashoffset = offset.toFixed(2);
        npRingProgress.style.stroke = ringColor;
      }
    }

    function loop() { updateClock(); requestAnimationFrame(loop); }
    loop();

    /* ================== TOP GLOBAL via WS ==================== */
    var topMinimumDuration = 200;
    var topPressedAt = 0;
    var ws = null;

    function sendTopState(active) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "top", studio: studio, active: !!active, fromUser: userName }));
        } catch (e) {}
      }
    }

    if (topBtn) {
      function topStart(e) {
        if (e && e.preventDefault) e.preventDefault();
        topPressedAt = Date.now();
        topActive = true;
        topBtn.classList.add("btn-active");
        updateBackground();
        // Son désactivé
        // if (topSound && topSound.play) {
        //   try { topSound.currentTime = 0; topSound.play().catch(function () {}); } catch (err) {}
        // }
        sendTopState(true);
      }

      function topEnd(e) {
        if (!topActive) return;
        if (e && e.preventDefault) e.preventDefault();

        var elapsed = Date.now() - topPressedAt;
        var remaining = topMinimumDuration - elapsed;

        function finalize() {
          topActive = false;
          topBtn.classList.remove("btn-active");
          updateBackground();
          sendTopState(false);
        }
        if (remaining <= 0) finalize();
        else setTimeout(finalize, remaining);
      }

      topBtn.addEventListener("mousedown", topStart, false);
      topBtn.addEventListener("touchstart", topStart, false);
      window.addEventListener("mouseup", topEnd, false);
      window.addEventListener("mouseleave", topEnd, false);
      window.addEventListener("touchend", topEnd, false);
      window.addEventListener("touchcancel", topEnd, false);
      
      // Raccourci clavier : flèche haute
      window.addEventListener("keydown", function(e) {
        if (e.key === "ArrowUp" || e.keyCode === 38) {
          if (!topActive) {
            e.preventDefault();
            topStart(e);
          }
        }
      }, false);
      
      window.addEventListener("keyup", function(e) {
        if (e.key === "ArrowUp" || e.keyCode === 38) {
          if (topActive) {
            e.preventDefault();
            topEnd(e);
          }
        }
      }, false);
    }

    if (ordresBtn) {
      ordresBtn.addEventListener("click", function (e) {
        if (e && e.preventDefault) e.preventDefault();
        setOnAirState(!simOnAir);
      });
    }

    /* ================== CHAT / WS ==================== */
    var chatOverlay = byId("chat-overlay");
    var chatClose = byId("chat-close");
    var chatBody = byId("chat-modal-body");
    var chatInput = byId("chat-input");
    var chatSend = byId("chat-send");
    var chatLastInline = byId("chat-last-inline");

    var messages = [];
    function updateLastMessageUI() {
      var last = messages[messages.length - 1];
      var userSpan = byId("chat-last-user");
      var textSpan = byId("chat-last-inline-text");
      if (!last) {
        if (userSpan) userSpan.textContent = "Messagerie :";
        if (textSpan) textSpan.textContent = "Aucun message";
        return;
      }
      if (userSpan) userSpan.textContent = (last.user || "Inconnu") + " :";
      if (textSpan) textSpan.textContent = last.text || "";
    }

    function renderMessages() {
      if (!chatBody) return;
      chatBody.innerHTML = "";
      for (var k = 0; k < messages.length; k++) {
        var msg = messages[k];
        var div = document.createElement("div");
        div.className = "chat-message";
        var header = document.createElement("div");
        header.className = "chat-message-header";
        var spanFrom = document.createElement("span");
        spanFrom.textContent = msg.user || "???";
        var spanTime = document.createElement("time");
        spanTime.textContent = msg.ts ? msg.ts.substring(11, 16) : nowHHMM();
        header.appendChild(spanFrom); header.appendChild(spanTime);
        var textDiv = document.createElement("div");
        textDiv.className = "chat-message-text";
        textDiv.textContent = msg.text;
        div.appendChild(header); div.appendChild(textDiv);
        chatBody.appendChild(div);
      }
      chatBody.scrollTop = chatBody.scrollHeight;
      updateLastMessageUI();
    }

    function openChat() { if (chatOverlay) chatOverlay.style.display = "flex"; }
    function closeChat() { if (chatOverlay) chatOverlay.style.display = "none"; }

    if (chatLastInline) chatLastInline.addEventListener("click", openChat);
    if (chatOverlay) chatOverlay.addEventListener("click", function (e) {
      if (e && e.target === chatOverlay) closeChat();
    });
    if (chatClose) chatClose.addEventListener("click", function (e) {
      if (e && e.preventDefault) e.preventDefault(); closeChat();
    });

    function addMessageFromBackend(entry) {
      if (!entry) return;
      messages.push({
        user: entry.user || "???",
        text: entry.text || "",
        ts: entry.ts || new Date().toISOString()
      });
      renderMessages();
    }

    function sendMessage() {
      if (!chatInput) return;
      var text = (chatInput.value || "").trim();
      if (!text) return;

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "chat", text: text }));
      } else {
        messages.push({ user: userName, text: text, ts: new Date().toISOString() });
        renderMessages();
      }
      chatInput.value = "";
    }

    if (chatSend) chatSend.addEventListener("click", function (e) {
      if (e && e.preventDefault) e.preventDefault(); sendMessage();
    });
    if (chatInput) chatInput.addEventListener("keydown", function (e) {
      var code = e.keyCode || e.which;
      if (code === 13) { if (e.preventDefault) e.preventDefault(); sendMessage(); }
    });

    var monWsEl = byId("mon-ws");
    var monLastWsEl = byId("mon-lastws");
    function initWebSocket() {
      var protocol = (location.protocol === "https:") ? "wss" : "ws";
      ws = new WebSocket(protocol + "://" + location.host + "/ws");

      ws.addEventListener("open", function () {
        faviconSetConnected(true);
        if (monWsEl) monWsEl.textContent = "Connecté";
        ws.send(JSON.stringify({ type: "hello", role: "tech", user: userName }));
      });

      ws.addEventListener("message", function (event) {
        if (monLastWsEl) monLastWsEl.textContent = event.data.substring(0, 120);

        var data;
        try { data = JSON.parse(event.data); } catch (e) { return; }

        if (data.type === "history" && Array.isArray(data.history)) {
          messages = data.history.map(function (m) {
            return { user: m.user || "???", text: m.text || "", ts: m.ts || new Date().toISOString() };
          });
          renderMessages();
        }

        if (data.type === "chat" && data.message) addMessageFromBackend(data.message);
        if (data.type === "nowPlaying" && data.nowPlaying) applyNowPlaying(data.nowPlaying);

        if (data.type === "top") {
          if (data.studio && data.studio !== studio) return;
          
          var wasActive = topActive;
          topActive = !!data.active;
          
          if (topBtn) topBtn.classList.toggle("btn-active", topActive);
          updateBackground();
          
          // Son de notification pour les autres clients (pas celui qui a pressé)
          if (!wasActive && topActive && data.fromUser !== userName) {
            try {
              var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
              var oscillator = audioCtx.createOscillator();
              var gainNode = audioCtx.createGain();
              oscillator.connect(gainNode);
              gainNode.connect(audioCtx.destination);
              oscillator.frequency.value = 800;
              oscillator.type = 'sine';
              gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
              oscillator.start(audioCtx.currentTime);
              oscillator.stop(audioCtx.currentTime + 0.3);
            } catch(e) {}
          }
        }

        if (data.type === "monitor" && data.arduinos) {
          renderArduinoMonitoring(data.arduinos);
        }
      });

      ws.addEventListener("close", function () {
        faviconSetConnected(false);
        if (monWsEl) monWsEl.textContent = "Déconnecté";
        setTimeout(initWebSocket, 5000);
      });
    }
    initWebSocket();

    /* ================== MODAL CONFIG / MONITORING ==================== */
    var configOverlay = byId("config-overlay");
    var btnConfig = byId("btn-config");
    var configClose = byId("config-close");
    var tabConfig = byId("tab-config");
    var tabMonitor = byId("tab-monitor");
    var tabDisplay = byId("tab-display");
    var configContent = byId("config-content");
    var monitorContent = byId("monitor-content");
    var displayContent = byId("display-content");

    function openConfig() { if (configOverlay) configOverlay.style.display = "flex"; }
    function closeConfig() { if (configOverlay) configOverlay.style.display = "none"; }

    function showTab(which) {
      // Remove active from all tabs
      if (tabConfig) tabConfig.classList.remove("active");
      if (tabMonitor) tabMonitor.classList.remove("active");
      if (tabDisplay) tabDisplay.classList.remove("active");
      
      // Hide all contents
      if (configContent) configContent.classList.add("hidden");
      if (monitorContent) monitorContent.classList.add("hidden");
      if (displayContent) displayContent.classList.add("hidden");
      
      // Show selected tab
      if (which === "config") {
        if (tabConfig) tabConfig.classList.add("active");
        if (configContent) configContent.classList.remove("hidden");
      } else if (which === "monitor") {
        if (tabMonitor) tabMonitor.classList.add("active");
        if (monitorContent) monitorContent.classList.remove("hidden");
      } else if (which === "display") {
        if (tabDisplay) tabDisplay.classList.add("active");
        if (displayContent) displayContent.classList.remove("hidden");
      }
    }

    if (btnConfig) btnConfig.addEventListener("click", openConfig);
    if (configClose) configClose.addEventListener("click", closeConfig);
    if (configOverlay) configOverlay.addEventListener("click", function (e) {
      if (e && e.target === configOverlay) closeConfig();
    });
    if (tabConfig) tabConfig.addEventListener("click", function(){ showTab("config"); });
    if (tabMonitor) tabMonitor.addEventListener("click", function(){ showTab("monitor"); });
    if (tabDisplay) tabDisplay.addEventListener("click", function(){ showTab("display"); });

    /* ===== Simulations ON AIR / TOP ===== */
    var simOnAirToggle = byId("sim-onair-toggle");
    var simOnAirReset = byId("sim-onair-reset");
    var simTopPulse = byId("sim-top-pulse");

    if (simOnAirToggle) simOnAirToggle.addEventListener("click", function(){
      setOnAirState(!simOnAir);
      // broadcast si possible
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type:"simulate", kind:"onair", active: simOnAir, studio: studio }));
      }
    });

    if (simOnAirReset) simOnAirReset.addEventListener("click", function(){
      setOnAirState(simOnAir, true);
    });

    if (simTopPulse) simTopPulse.addEventListener("click", function(){
      topActive = true;
      if (topBtn) topBtn.classList.add("btn-active");
      updateBackground();
      sendTopState(true);
      setTimeout(function(){
        topActive = false;
        if (topBtn) topBtn.classList.remove("btn-active");
        updateBackground();
        sendTopState(false);
      }, 350);
    });

    /* ===== Simulateur NP ===== */
    var simNpArtist = byId("sim-np-artist");
    var simNpTitle = byId("sim-np-title");
    var simNpDuration = byId("sim-np-duration");
    var simNpIntro = byId("sim-np-intro");
    var simNpOutro = byId("sim-np-outro");
    var simNpSend = byId("sim-np-send");
    var simNpClear = byId("sim-np-clear");
    var preset1 = byId("sim-np-preset1");
    var preset2 = byId("sim-np-preset2");

    function buildSimNp() {
      return {
        artist: (simNpArtist && simNpArtist.value || "").trim(),
        title: (simNpTitle && simNpTitle.value || "").trim(),
        durationMs: Number(simNpDuration && simNpDuration.value || 0) * 1000,
        introMs: Number(simNpIntro && simNpIntro.value || 0) * 1000,
        outroMs: Number(simNpOutro && simNpOutro.value || 0) * 1000,
        receivedAt: Date.now()
      };
    }

    function sendSimNp(np) {
      // 1) tente backend simulate
      fetch("/api/nowplaying/simulate", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(np)
      }).then(function(r){ return r.json(); })
        .then(function(res){
          if (!res || !res.ok) throw new Error("no simulate");
        })
        .catch(function(){
          // 2) fallback local + WS broadcast
          applyNowPlaying(np);
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type:"nowPlaying", nowPlaying: np, studio: studio }));
          }
        });
    }

    if (simNpSend) simNpSend.addEventListener("click", function(){
      var np = buildSimNp();
      if (!np.artist && !np.title) return;
      sendSimNp(np);
    });

    if (simNpClear) simNpClear.addEventListener("click", function(){
      applyNowPlaying(null);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type:"nowPlaying", nowPlaying: null, studio: studio }));
      }
    });

    if (preset1) preset1.addEventListener("click", function(){
      if (simNpArtist) simNpArtist.value = "ARTISTE TEST";
      if (simNpTitle) simNpTitle.value = "TITRE TEST";
      if (simNpDuration) simNpDuration.value = 120;
      if (simNpIntro) simNpIntro.value = 8;
      if (simNpOutro) simNpOutro.value = 12;
    });

    if (preset2) preset2.addEventListener("click", function(){
      if (simNpArtist) simNpArtist.value = "PUB";
      if (simNpTitle) simNpTitle.value = "SPOT";
      if (simNpDuration) simNpDuration.value = 30;
      if (simNpIntro) simNpIntro.value = 0;
      if (simNpOutro) simNpOutro.value = 0;
    });

    /* ===== Monitoring refresh ===== */
    var monHealthEl = byId("mon-health");
    var monNtpEl = byId("mon-ntp");
    var monArduinosEl = byId("mon-arduinos");

    function refreshMonitoring() {
      fetch("/api/health").then(r=>r.json()).then(function(res){
        if (monHealthEl) monHealthEl.textContent = (res && res.ok) ? "OK" : "OFF";
      }).catch(function(){
        if (monHealthEl) monHealthEl.textContent = "OFF";
      });

      fetch("/api/ntp").then(r=>r.json()).then(function(res){
        if (monNtpEl) monNtpEl.textContent = (res && typeof res.offsetMs==="number")
          ? (res.offsetMs.toFixed(1) + " ms") : "—";
      }).catch(function(){
        if (monNtpEl) monNtpEl.textContent = "—";
      });
    }

    function renderArduinoMonitoring(list) {
      if (!monArduinosEl || !list) return;
      monArduinosEl.innerHTML = "";
      list.forEach(function(a){
        var div = document.createElement("div");
        div.className = "arduino-item";
        var st = a.studio || a.id || "?";
        var ok = a.ok ? "OK" : "OFF";
        var age = (typeof a.lastSeenSec==="number") ? (" ("+a.lastSeenSec+"s)") : "";
        div.textContent = st + " : " + ok + age;
        monArduinosEl.appendChild(div);
      });
    }

    setInterval(refreshMonitoring, 4000);
    refreshMonitoring();

    /* ================== PLAYER MODAL (embed Radio France) ==================== */
    var btnPlayer = byId("btn-player");
    var playerOverlay = byId("player-overlay");
    var playerClose = byId("player-close");

    function openPlayer() {
      if (playerOverlay) playerOverlay.style.display = "flex";
    }
    function closePlayer() {
      if (playerOverlay) playerOverlay.style.display = "none";
    }

    if (btnPlayer) btnPlayer.addEventListener("click", openPlayer);
    if (playerClose) playerClose.addEventListener("click", closePlayer);
    if (playerOverlay) playerOverlay.addEventListener("click", function(e){
      if (e && e.target === playerOverlay) closePlayer();
    });

    /* ================== CONFIGURATION DISPLAY ==================== */

function getCheckedRotationModes() {
  var modes = [];
  document.querySelectorAll(".rot-mode").forEach(function (cb) {
    if (cb.checked) modes.push(cb.value);
  });
  return modes;
}

// Inputs Display (anciens + nouveaux)
var displayApiToken = byId("display-api-token");
var displaySaveToken = byId("display-save-token");
var displayTestApi = byId("display-test-api");
var displayDemoToggle = byId("display-demo-toggle");
var demoModeStatus = byId("demo-mode-status");

var displayMode = byId("display-mode");

// IMPORTANT: ton HTML a 2 selects de thème.
// On privilégie display-theme-select (nouveau). Si absent, on prend display-theme (ancien).
var displayThemeSelect = byId("display-theme-select");
var displayThemeLegacy = byId("display-theme");

var displayEventTitle = byId("display-event-title");
var displayEventSubtitle = byId("display-event-subtitle");
var displayEventDetails = byId("display-event-details");
var displayEventImage = byId("display-event-image");
var displayEventImageFile = byId("display-event-image-file");
var displayEventUpload = byId("display-event-upload");
var displayEventClearImage = byId("display-event-clear-image");
var eventImagePreview = byId("event-image-preview");
var eventImagePreviewImg = byId("event-image-preview-img");
var displayEventPreview = byId("display-event-preview");
var displayEventSaveQuick = byId("display-event-save-quick");

// AutoSwitch (existant chez toi)
var displayAutoSwitchEnabled = byId("display-auto-switch-enabled");
var displayAutoSwitchInterval = byId("display-auto-switch-interval");

// Rotation (nouvelle logique)
var displayRotationEnabled = byId("display-rotation-enabled");
var displayRotationInterval = byId("display-rotation-interval");

// Podcast
var displayPodcastEnabled = byId("display-podcast-enabled");
var displayPodcastUrl = byId("display-podcast-url");

// Bumper
var displayBumperEnabled = byId("display-bumper-enabled");
var displayBumperDuration = byId("display-bumper-duration");

// Boutons
var displaySaveBtn = byId("display-save-btn");
var displayOpenPage = byId("display-open-page");
var displayResetConfig = byId("display-reset-config");
var displaySaveConfig = byId("display-save-config");

var eventConfigSection = byId("event-config");

// ----- helpers thème -----
function getThemeValue() {
  if (displayThemeSelect) return displayThemeSelect.value;
  if (displayThemeLegacy) return displayThemeLegacy.value;
  return "light";
}
function setThemeValue(v) {
  if (displayThemeSelect) displayThemeSelect.value = v;
  if (displayThemeLegacy) displayThemeLegacy.value = v;
}

// ----- Charger config display depuis localStorage -----
function loadDisplayConfig() {
  try {
    var cfg = JSON.parse(localStorage.getItem("display_config") || "{}");

    if (displayMode) displayMode.value = cfg.mode || "show";
    setThemeValue(cfg.theme || "light");

    if (displayEventTitle) displayEventTitle.value = cfg.eventTitle || "";
    if (displayEventSubtitle) displayEventSubtitle.value = cfg.eventSubtitle || "";
    if (displayEventDetails) displayEventDetails.value = cfg.eventDetails || "";
    if (displayEventImage) displayEventImage.value = cfg.eventImage || "";

    if (displayAutoSwitchEnabled)
      displayAutoSwitchEnabled.checked = cfg.autoSwitchEventEnabled !== false;
    if (displayAutoSwitchInterval)
      displayAutoSwitchInterval.value = (cfg.autoSwitchEventInterval || 20000) / 1000;

    if (displayRotationEnabled)
      displayRotationEnabled.checked = !!cfg.rotationEnabled;

    // ⚠️ Dans display.js v2 l'intervalle est en ms.
    if (displayRotationInterval)
      displayRotationInterval.value = cfg.rotationInterval || 60000;

    // Rotation modes
    var modesSet = new Set(cfg.rotationModes || []);
    document.querySelectorAll(".rot-mode").forEach(function (cb) {
      cb.checked = modesSet.has(cb.value);
    });

    // Podcast
    if (displayPodcastEnabled)
      displayPodcastEnabled.checked = cfg.podcastEnabled !== false;
    if (displayPodcastUrl)
      displayPodcastUrl.value = cfg.podcastRssUrl ||
        "https://radiofrance-podcast.net/podcast09/podcast_01bcfbf6-efda-44c7-88f4-300aafef9039.xml";

    // Bumper
    if (displayBumperEnabled)
      displayBumperEnabled.checked = cfg.bumperEnabled !== false;
    if (displayBumperDuration)
      displayBumperDuration.value = cfg.bumperDurationMs || 6000;

    // Token API
    if (displayApiToken && window.RadioFranceAPI) {
      displayApiToken.value = window.RadioFranceAPI.getToken
        ? (window.RadioFranceAPI.getToken() || "")
        : "";
    }

    updateImagePreview();
    updateDemoModeUI();
    toggleEventConfig();
  } catch (e) {
    console.error("Erreur chargement config display:", e);
  }
}

function toggleEventConfig() {
  if (!eventConfigSection || !displayMode) return;
  eventConfigSection.style.display =
    displayMode.value === "event" ? "block" : "none";
}

// ----- Sauvegarder config display vers localStorage -----
function saveDisplayConfigToStorage() {
  var cfg = {
    mode: displayMode ? displayMode.value : "show",
    theme: getThemeValue(),

    eventTitle: displayEventTitle ? displayEventTitle.value : "",
    eventSubtitle: displayEventSubtitle ? displayEventSubtitle.value : "",
    eventDetails: displayEventDetails ? displayEventDetails.value : "",
    eventImage: displayEventImage ? displayEventImage.value : "",

    autoSwitchEventEnabled: displayAutoSwitchEnabled
      ? displayAutoSwitchEnabled.checked
      : false,
    autoSwitchEventInterval: displayAutoSwitchInterval
      ? parseInt(displayAutoSwitchInterval.value || "20", 10) * 1000
      : 20000,

    rotationEnabled: displayRotationEnabled
      ? displayRotationEnabled.checked
      : false,
    rotationInterval: displayRotationInterval
      ? parseInt(displayRotationInterval.value || "60000", 10)
      : 60000,
    rotationModes: getCheckedRotationModes(),

    podcastEnabled: displayPodcastEnabled
      ? displayPodcastEnabled.checked
      : true,
    podcastRssUrl: displayPodcastUrl
      ? displayPodcastUrl.value.trim()
      : "",

    bumperEnabled: displayBumperEnabled
      ? displayBumperEnabled.checked
      : true,
    bumperDurationMs: displayBumperDuration
      ? parseInt(displayBumperDuration.value || "6000", 10)
      : 6000,

    stationId: window.RadioFranceAPI
      ? window.RadioFranceAPI.STATIONS.ici_orleans
      : "39"
  };

  localStorage.setItem("display_config", JSON.stringify(cfg));
  console.log("[Tech] display_config saved:", cfg);
}

// ----- Demo UI RadioFrance -----
function updateDemoModeUI() {
  if (!window.RadioFranceAPI) return;
  var isDemoMode = localStorage.getItem("radiofrance_demo_mode") === "true";
  if (demoModeStatus) {
    demoModeStatus.style.display = isDemoMode ? "block" : "none";
  }
  if (displayDemoToggle) {
    displayDemoToggle.textContent = isDemoMode ? "✓ Mode Démo" : "Mode Démo";
    displayDemoToggle.className = isDemoMode ? "mini-btn" : "mini-btn ghost";
  }
}

if (displayDemoToggle) {
  displayDemoToggle.addEventListener("click", function () {
    if (!window.RadioFranceAPI) return;
    var currentMode =
      localStorage.getItem("radiofrance_demo_mode") === "true";
    var newMode = !currentMode;

    window.RadioFranceAPI.setDemoMode(newMode);
    window.RadioFranceAPI.clearCache && window.RadioFranceAPI.clearCache();
    updateDemoModeUI();

    alert(
      newMode
        ? "✅ Mode démo activé\n\nDonnées de test affichées en attendant le token API."
        : "✅ Mode démo désactivé\n\nUtilisation de l'API Radio France réelle."
    );
  });
}

// ----- Save Token -----
if (displaySaveToken) {
  displaySaveToken.addEventListener("click", function () {
    if (!displayApiToken || !window.RadioFranceAPI) return;
    var token = displayApiToken.value.trim();
    if (token) {
      window.RadioFranceAPI.setToken(token);
      alert("✅ Token API enregistré !");
    } else {
      alert("⚠️ Veuillez entrer un token valide");
    }
  });
}

// ----- Test API -----
if (displayTestApi) {
  displayTestApi.addEventListener("click", function () {
    if (!window.RadioFranceAPI || !window.RadioFranceAPI.hasToken()) {
      alert("⚠️ Token API non configuré");
      return;
    }

    displayTestApi.textContent = "Test...";
    displayTestApi.disabled = true;

    window.RadioFranceAPI.getStationInfo()
      .then(function (station) {
        if (station) {
          alert(
            "✅ API fonctionnelle !\n\nStation: " +
              station.title +
              "\n" +
              station.baseline
          );
        } else {
          alert("❌ Erreur lors du test de l'API");
        }
      })
      .catch(function (err) {
        alert("❌ Erreur: " + err.message);
      })
      .finally(function () {
        displayTestApi.textContent = "Tester API";
        displayTestApi.disabled = false;
      });
  });
}

// ----- Image preview / upload -----
function updateImagePreview() {
  if (!eventImagePreview || !eventImagePreviewImg) return;
  var imageUrl = displayEventImage ? displayEventImage.value : "";
  if (imageUrl) {
    eventImagePreviewImg.src = imageUrl;
    eventImagePreview.style.display = "block";
  } else {
    eventImagePreview.style.display = "none";
  }
}

if (displayEventUpload && displayEventImageFile) {
  displayEventUpload.addEventListener("click", function () {
    var file = displayEventImageFile.files[0];
    if (!file) {
      alert("⚠️ Veuillez sélectionner une image");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("⚠️ Image trop volumineuse (max 2 Mo)");
      return;
    }
    if (!file.type.match(/^image\/(jpeg|jpg|png|gif|webp)/)) {
      alert("⚠️ Format non supporté. Utilisez JPG, PNG, GIF ou WebP");
      return;
    }

    var reader = new FileReader();
    reader.onload = function (e) {
      var base64 = e.target.result;
      if (displayEventImage) {
        displayEventImage.value = base64;
      }
      updateImagePreview();
      alert("✅ Image chargée ! N'oubliez pas d'enregistrer.");
    };
    reader.onerror = function () {
      alert("❌ Erreur lors du chargement de l'image");
    };
    reader.readAsDataURL(file);
  });
}

if (displayEventClearImage) {
  displayEventClearImage.addEventListener("click", function () {
    if (displayEventImage) displayEventImage.value = "";
    if (displayEventImageFile) displayEventImageFile.value = "";
    updateImagePreview();
  });
}

if (displayEventImage) {
  displayEventImage.addEventListener("input", updateImagePreview);
}

// ----- Mode change -----
if (displayMode) {
  displayMode.addEventListener("change", toggleEventConfig);
}

// ----- Preview event -----
if (displayEventPreview) {
  displayEventPreview.addEventListener("click", function () {
    if (!displayEventTitle || !displayEventTitle.value.trim()) {
      alert("⚠️ Veuillez entrer un titre d'événement");
      return;
    }
    saveDisplayConfigToStorage();
    window.open("display.html", "DisplayPreview");
  });
}

if (displayEventSaveQuick) {
  displayEventSaveQuick.addEventListener("click", function () {
    if (!displayEventTitle || !displayEventTitle.value.trim()) {
      alert("⚠️ Veuillez entrer un titre d'événement");
      return;
    }
    if (displayMode) displayMode.value = "event";
    saveDisplayConfigToStorage();
    alert(
      "✅ Événement enregistré !\n\nCliquez sur \"Ouvrir Display\" pour afficher."
    );
  });
}

// ----- Save buttons -----
if (displaySaveBtn) {
  displaySaveBtn.addEventListener("click", function () {
    saveDisplayConfigToStorage();
    loadDisplayConfig();
    console.log("[Tech] Display config saved");
  });
}

if (displaySaveConfig) {
  displaySaveConfig.addEventListener("click", function () {
    saveDisplayConfigToStorage();
    alert("✅ Configuration enregistrée !");
  });
}

if (displayOpenPage) {
  displayOpenPage.addEventListener("click", function () {
    window.open("display.html", "_blank");
  });
}

if (displayResetConfig) {
  displayResetConfig.addEventListener("click", function () {
    if (confirm("Réinitialiser toute la configuration Display ?")) {
      localStorage.removeItem("display_config");
      loadDisplayConfig();
      alert("✅ Configuration réinitialisée");
    }
  });
}

// Charger la config au démarrage
loadDisplayConfig();

  });
})();
