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

    // SVG du favicon (ton logo disque) avec couleurs placeholders __C1__/__C2__
    var faviconBaseSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128.5">
  <style>
    .s0{fill:#000000}
    .s1{fill:__C1__}
    .s2{fill:__C2__}
  </style>
  <g transform="translate(0,-0.9)">
    <path class="s1" d="M 64,129.4 C 28.6,129.4 0,100.7 0,65.1 0,29.6 28.6,0.9 64,0.9 c 35.4,0 64,28.7 64,64.2 0,35.6 -28.6,64.3 -64,64.3 z"/>
    <path class="s0" d="m 64,65.1 v 64.3 H 0 V 65.1 Z"/>
    <path class="s2" fill-rule="evenodd" d="M 63.9,129.4 H 64 V 65.1 H 0 c 0,35.5 28.6,64.2 63.9,64.3 z"/>
  </g>
</svg>`.trim();

    // Palettes
    var faviconColors = {
      "default":   { c1: "#0064f5", c2: "#001ed2" },   // bleu
      "onair":     { c1: "#ff5757", c2: "#b00000" },   // rouge
      "connected": { c1: "#36ff9b", c2: "#019454" }    // vert
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
      if (faviconState.onAir) {
        mode = "onair";
      } else if (faviconState.connected) {
        mode = "connected";
      }

      var col = faviconColors[mode] || faviconColors["default"];
      var svg = faviconBaseSvg
        .replace(/__C1__/g, col.c1)
        .replace(/__C2__/g, col.c2);

      var link = ensureFaviconLink();
      link.href = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
    }

    function faviconSetOnAir(on) {
      faviconState.onAir = !!on;
      refreshFavicon();
    }

    function faviconSetConnected(on) {
      faviconState.connected = !!on;
      refreshFavicon();
    }

    /* ================== THÈME & ÉTAT GLOBAL ==================== */

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

    // On initialise le favicon en bleu
    refreshFavicon();

    /* USER / RÔLE / STUDIO + BOUTON RETOUR */

    var headerOnAirChrono = byId("onair-chrono-header");
    var btnHome = byId("btn-home");

    var userName = "Moi";
    var userRole = null;
    var studio = "A";

    try {
      var storedName = window.localStorage.getItem("clock_user_name");
      if (storedName) userName = storedName;

      var storedRole = window.localStorage.getItem("clock_user_role");
      if (storedRole) userRole = storedRole;

      var storedStudio = window.localStorage.getItem("clock_user_studio");
      if (storedStudio) studio = storedStudio.toUpperCase();
    } catch (e) {}

    var search = window.location.search;
    if (search.length > 1) {
      try {
        var params = new URLSearchParams(search);
        if (params.has("studio")) {
          studio = (params.get("studio") || "A").toUpperCase();
        }
      } catch (e) {}
    }

    if (btnHome) {
      btnHome.addEventListener("click", function (e) {
        if (e && e.preventDefault) e.preventDefault();
        window.location.href = "index.html";
      });
    }

    /* HORLOGE / NP / POINTS / NTP */

    var clockTimeEl = byId("clock-time");
    var onairLabelEl = byId("onair-label");
    var npPhaseLabelEl = byId("np-phase-label");
    var npChronoMainEl = byId("np-chrono-main");
    var npRingProgress = byId("np-ring-progress");
    var dotsLayer = byId("dots-layer");

    var npArtistEl = byId("np-artist");
    var npTitleEl = byId("np-title");
    
    // Référence au cercle de fond de l'horloge
    var clockBackgroundCircle = document.querySelector(".clock-background-circle");

    var currentNP = null;

    function applyNowPlaying(np) {
      // np est la structure renvoyée par /api/nowplaying.nowPlaying
      if (!np || (!np.title && !np.artist)) {
        currentNP = null;
        if (npArtistEl) npArtistEl.textContent = " ";
        if (npTitleEl)  npTitleEl.textContent  = " ";
        return;
      }

      currentNP = np;

      if (!currentNP.receivedAt) {
        currentNP.receivedAt = Date.now();
      } else if (typeof currentNP.receivedAt === "string") {
        // on stocke en ms pour faciliter les calculs
        currentNP.receivedAt = new Date(currentNP.receivedAt).getTime();
      }

      if (npArtistEl) npArtistEl.textContent = np.artist || " ";
      if (npTitleEl)  npTitleEl.textContent  = np.title  || " ";
    }

    function fetchNowPlayingOnce() {
      fetch("/api/nowplaying")
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.ok && res.nowPlaying) {
            applyNowPlaying(res.nowPlaying);
          } else {
            applyNowPlaying(null);
          }
        })
        .catch(function () {
          // en cas d'erreur, on ne casse rien
        });
    }

    fetchNowPlayingOnce();
    setInterval(fetchNowPlayingOnce, 10000);

    var topBtn = byId("btn-top");
    var ordresBtn = byId("btn-ordres");
    var topSound = byId("top-sound");

    // Pré-chargement audio TOP
    if (topSound) {
      const wakeAudio = function () {
        try {
          topSound.volume = 0;
          topSound.play().catch(function () {});
          setTimeout(function () {
            try {
              topSound.pause();
              topSound.currentTime = 0;
            } catch (e) {}
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
      if (topActive) {
        body.classList.add("status-top");
      } else if (simOnAir) {
        body.classList.add("status-onair");
      } else {
        body.classList.add("status-default");
      }
    }

    function setOnAirState(active) {
      simOnAir = !!active;
      if (simOnAir) {
        onAirStart = Date.now();
        onAirRunning = true;
        if (onairLabelEl) onairLabelEl.textContent = "ON AIR";
        if (ordresBtn) ordresBtn.classList.add("btn-active");
      } else {
        if (onAirRunning) {
          onAirFrozenSec = (Date.now() - onAirStart) / 1000;
        }
        onAirRunning = false;
        if (onairLabelEl) onairLabelEl.textContent = "";
        if (ordresBtn) ordresBtn.classList.remove("btn-active");
      }
      updateBackground();
      faviconSetOnAir(simOnAir);   // favicon rouge / normal
    }

    setOnAirState(false);

    // Points (60 secondes)
    var DOT_COUNT = 60;
    var DOT_RADIUS = 1.9;
    var DOT_RING_RADIUS = 80;
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

    // NTP offset
    var clockOffsetMs = 0;
    fetch("/api/ntp")
      .then(function (r) { return r.json(); })
      .then(function (ntp) {
        if (ntp && typeof ntp.offsetMs === "number") {
          clockOffsetMs = ntp.offsetMs;
        }
      })
      .catch(function () {});

    var lastSecond = null;

    function updateClock() {
      var now = new Date(Date.now() + clockOffsetMs);
      var sec = now.getSeconds();
      var hh = pad2(now.getHours());
      var mm = pad2(now.getMinutes());
      var ss = pad2(sec);

      if (clockTimeEl) clockTimeEl.textContent = hh + ":" + mm + ":" + ss;

      if (dots.length === DOT_COUNT && sec !== lastSecond) {
        if (sec === 0) {
          for (var j = 0; j < dots.length; j++) {
            dots[j].classList.remove("active");
          }
        }
        if (dots[sec]) dots[sec].classList.add("active");
        lastSecond = sec;
      }

      // Chrono ON AIR
      var chronoSec = onAirRunning ? (Date.now() - onAirStart) / 1000 : onAirFrozenSec;
      if (headerOnAirChrono) headerOnAirChrono.textContent = formatMMSS(chronoSec);

      // ======= GESTION NOW PLAYING (version simple, mais propre) =======
      var display = "";
      var ringFraction = 0;
      var rootStyle = window.getComputedStyle(document.documentElement);
      var ringColor = rootStyle.getPropertyValue("--np-green").trim() || "#23d56b";
      var npTextColor = ringColor;
      var phaseText = "";

      if (!currentNP) {
        // Pas de titre en diffusion : on "efface" le NP
        if (npPhaseLabelEl) npPhaseLabelEl.textContent = "";
        if (npChronoMainEl) npChronoMainEl.textContent = "";
        if (npRingProgress) {
          var R0 = 70;
          var circ0 = 2 * Math.PI * R0;
          npRingProgress.style.strokeDasharray = circ0.toFixed(2);
          npRingProgress.style.strokeDashoffset = circ0.toFixed(2);
          npRingProgress.style.stroke = ringColor;
        }
      } else if (currentNP.receivedAt) {
        var nowTime = Date.now() + clockOffsetMs;
        var receivedTime = currentNP.receivedAt;
        var elapsed = (nowTime - receivedTime) / 1000;

        var duration = (currentNP.durationMs || 0) / 1000;
        var intro = (currentNP.introMs || 0) / 1000;
        var outro = (currentNP.outroMs || 0) / 1000;

        if (elapsed < 0) elapsed = 0;

        if (duration > 0) {
          // Barre : toujours basée sur elapsed / duration (0 à 100%)
          ringFraction = duration > 0 ? (elapsed / duration) : 0;
          
          var remainingSec = duration - elapsed;
          
          // Fond orange dans les 5 dernières secondes
          if (clockBackgroundCircle) {
            if (remainingSec > 0 && remainingSec <= 5) {
              clockBackgroundCircle.style.fill = "rgba(255, 159, 10, 0.3)";
              clockBackgroundCircle.style.stroke = "rgba(255, 159, 10, 0.5)";
            } else {
              clockBackgroundCircle.style.fill = "";
              clockBackgroundCircle.style.stroke = "";
            }
          }
          
          // INTRO
          if (intro > 0 && elapsed < intro) {
            var remainIntro = intro - elapsed;
            display = formatMMSS(remainIntro);
            ringColor = rootStyle.getPropertyValue("--np-orange").trim() || "#ff9f0a";
            npTextColor = ringColor;
            phaseText = "INTRO";
          }
          // OUTRO
          else if (outro > 0 && elapsed > (duration - outro) && elapsed < duration) {
            var remainOutro = duration - elapsed;
            display = formatMMSS(remainOutro);
            ringColor = rootStyle.getPropertyValue("--np-orange").trim() || "#ff9f0a";
            npTextColor = ringColor;
            phaseText = "OUTRO";
          }
          // MAIN
          else if (elapsed < duration) {
            var remainMain = duration - elapsed;
            display = formatMMSS(remainMain);
            ringColor = rootStyle.getPropertyValue("--np-green").trim() || "#23d56b";
            npTextColor = ringColor;
            phaseText = "";
          }
          // FINI
          else {
            display = "";
            ringFraction = 1;
            ringColor = rootStyle.getPropertyValue("--text-muted").trim() || "#9c9ca4";
            npTextColor = ringColor;
            phaseText = "";
            // Réinitialiser le fond
            if (clockBackgroundCircle) {
              clockBackgroundCircle.style.fill = "";
              clockBackgroundCircle.style.stroke = "";
            }
          }
        }
      }

      if (npPhaseLabelEl) npPhaseLabelEl.textContent = phaseText;

      if (npChronoMainEl) {
        npChronoMainEl.textContent = display;
        npChronoMainEl.style.color = npTextColor;
      }

      // Afficher la durée de l'outro en dessous du chrono NP
      var npOutroDurationEl = document.getElementById("np-outro-duration");
      if (npOutroDurationEl) {
        if (outro > 0) {
          npOutroDurationEl.innerHTML = '<span class="label">outro</span>' + formatMMSS(outro);
        } else {
          npOutroDurationEl.textContent = "";
        }
      }

      if (npRingProgress) {
        if (ringFraction < 0) ringFraction = 0;
        if (ringFraction > 1) ringFraction = 1;
        var R = 70;
        var circumference = 2 * Math.PI * R;
        var offset = circumference * (1 - ringFraction);
        npRingProgress.style.strokeDasharray = circumference.toFixed(2);
        npRingProgress.style.strokeDashoffset = offset.toFixed(2);
        npRingProgress.style.stroke = ringColor;
      }
    }

    function loop() {
      updateClock();
      window.requestAnimationFrame(loop);
    }
    loop();

    /* TOP GLOBAL via WebSocket */

    var topMinimumDuration = 200;
    var topPressedAt = 0;

    var ws = null; // déclaré ici pour être visible par sendTopState

    function sendTopState(active) {
      console.log("[TOP] sendTopState appelé:", active, "ws:", ws ? ws.readyState : "null");
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          var msg = {
            type: "top",
            studio: studio,
            active: !!active,
            fromUser: userName
          };
          console.log("[TOP] Envoi message:", msg);
          ws.send(JSON.stringify(msg));
        } catch (e) {
          console.error("[TOP] Erreur envoi:", e);
        }
      } else {
        console.warn("[TOP] WebSocket non disponible");
      }
    }

    if (topBtn) {
      console.log("[TOP] Bouton TOP trouvé, attachement des événements");
      
      function topStart(e) {
        console.log("[TOP] topStart appelé");
        if (e && e.preventDefault) e.preventDefault();
        topPressedAt = Date.now();
        topActive = true;
        topBtn.classList.add("btn-active");
        updateBackground();

        // Son désactivé
        // if (topSound && topSound.play) {
        //   try {
        //     topSound.currentTime = 0;
        //     topSound.play().catch(function () {});
        //   } catch (err) {}
        // }

        sendTopState(true);
      }

      function topEnd(e) {
        console.log("[TOP] topEnd appelé, topActive:", topActive);
        if (!topActive) return;
        if (e && e.preventDefault) e.preventDefault();

        var elapsed = Date.now() - topPressedAt;
        var remaining = topMinimumDuration - elapsed;

        function finalize() {
          console.log("[TOP] finalize - désactivation");
          topActive = false;
          topBtn.classList.remove("btn-active");
          updateBackground();
          sendTopState(false);
        }

        if (remaining <= 0) {
          finalize();
        } else {
          setTimeout(finalize, remaining);
        }
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

    /* ORDRES BUTTON (Maintien/Relâché - avec canal configurable) */

    var ordresActive = false;

    // Charger l'état de la config ORDRES depuis localStorage
    var ordresEnabled = localStorage.getItem("ordres-enabled") !== "false";
    var ordresChannel = parseInt(localStorage.getItem("ordres-channel") || "1");
    
    if (ordresBtn) {
      ordresBtn.style.display = ordresEnabled ? "" : "none";
    }

    function sendOrdres(active) {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn("WebSocket not connected for ORDRES");
        return;
      }

      ws.send(JSON.stringify({
        type: "ordres",
        channel: ordresChannel,
        active: active
      }));

      console.log("ORDRES CH" + ordresChannel + " -> " + (active ? "ON" : "OFF"));
    }

    function ordresActivate(e) {
      if (e && e.preventDefault) e.preventDefault();
      if (ordresActive) return;

      ordresActive = true;
      if (ordresBtn) ordresBtn.classList.add("btn-active");
      sendOrdres(true);
    }

    function ordresDeactivate(e) {
      if (e && e.preventDefault) e.preventDefault();
      if (!ordresActive) return;

      ordresActive = false;
      if (ordresBtn) ordresBtn.classList.remove("btn-active");
      sendOrdres(false);
    }

    if (ordresBtn) {
      // Desktop: mousedown/mouseup
      ordresBtn.addEventListener("mousedown", ordresActivate, false);
      window.addEventListener("mouseup", function(e) {
        if (ordresActive) ordresDeactivate(e);
      }, false);

      // Mobile: touchstart/touchend
      ordresBtn.addEventListener("touchstart", ordresActivate, false);
      window.addEventListener("touchend", function(e) {
        if (ordresActive) ordresDeactivate(e);
      }, false);
      window.addEventListener("touchcancel", function(e) {
        if (ordresActive) ordresDeactivate(e);
      }, false);

      // Keyboard shortcut: Espace
      window.addEventListener("keydown", function(e) {
        if ((e.key === " " || e.keyCode === 32) && !ordresActive) {
          e.preventDefault();
          ordresActivate(e);
        }
      }, false);

      window.addEventListener("keyup", function(e) {
        if ((e.key === " " || e.keyCode === 32) && ordresActive) {
          e.preventDefault();
          ordresDeactivate(e);
        }
      }, false);
    }

    /* CHAT / WEBSOCKET */

    var chatOverlay = byId("chat-overlay");
    var chatModal = byId("chat-modal");
    var chatClose = byId("chat-close");
    var chatBody = byId("chat-modal-body");
    var chatInput = byId("chat-input");
    var chatSend = byId("chat-send");
    var chatLastInline = byId("chat-last-inline");
    var chatLastInlineText = byId("chat-last-inline-text");

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
        spanFrom.textContent = msg.user || msg.from || "???";
        var spanTime = document.createElement("time");
        spanTime.textContent = msg.ts ? msg.ts.substring(11, 16) : nowHHMM();
        header.appendChild(spanFrom);
        header.appendChild(spanTime);
        var textDiv = document.createElement("div");
        textDiv.className = "chat-message-text";
        textDiv.textContent = msg.text;
        div.appendChild(header);
        div.appendChild(textDiv);
        chatBody.appendChild(div);
      }
      chatBody.scrollTop = chatBody.scrollHeight;
      updateLastMessageUI();
    }

    function openChat() {
      if (!chatOverlay) return;
      chatOverlay.style.display = "flex";
    }

    function closeChat() {
      if (!chatOverlay) return;
      chatOverlay.style.display = "none";
    }

    if (chatLastInline) {
      chatLastInline.addEventListener("click", openChat);
    }

    if (chatOverlay) {
      chatOverlay.addEventListener("click", function (e) {
        if (e && e.target === chatOverlay) {
          closeChat();
        }
      });
    }

    if (chatClose) {
      chatClose.addEventListener("click", function (e) {
        if (e && e.preventDefault) e.preventDefault();
        closeChat();
      });
    }

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
        messages.push({
          user: userName,
          text: text,
          ts: new Date().toISOString()
        });
        renderMessages();
      }

      chatInput.value = "";
    }

    if (chatSend) {
      chatSend.addEventListener("click", function (e) {
        if (e && e.preventDefault) e.preventDefault();
        sendMessage();
      });
    }

    if (chatInput) {
      chatInput.addEventListener("keydown", function (e) {
        e = e || window.event;
        var code = e.keyCode || e.which;
        if (code === 13) {
          if (e.preventDefault) e.preventDefault();
          sendMessage();
        }
      });
    }

    function initWebSocketChat() {
      var protocol = window.location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(protocol + "://" + window.location.host + "/ws");

      ws.addEventListener("open", function () {
        faviconSetConnected(true);  // favicon vert
        ws.send(JSON.stringify({
          type: "hello",
          role: "chat",
          user: userName
        }));
      });

      ws.addEventListener("message", function (event) {
        var data;
        try {
          data = JSON.parse(event.data);
        } catch (e) {
          return;
        }

        if (data.type === "history" && Array.isArray(data.history)) {
          messages = data.history.map(function (m) {
            return {
              user: m.user || "???",
              text: m.text || "",
              ts: m.ts || new Date().toISOString()
            };
          });
          renderMessages();
        }

        if (data.type === "chat" && data.message) {
          addMessageFromBackend(data.message);
        }

        if (data.type === "nowPlaying" && data.nowPlaying) {
          applyNowPlaying(data.nowPlaying);
        }

        // Configuration ORDRES reçue
        if (data.type === "config" && data.config === "ordres") {
          var enabled = !!data.enabled;
          var channel = parseInt(data.channel || "1");
          
          localStorage.setItem("ordres-enabled", enabled);
          localStorage.setItem("ordres-channel", channel);
          
          ordresChannel = channel;
          
          if (ordresBtn) {
            ordresBtn.style.display = enabled ? "" : "none";
          }
          
          console.log("[CONFIG] ORDRES " + (enabled ? "activé" : "désactivé") + " - CH" + channel);
        }

        // TOP global reçu
        if (data.type === "top") {
          console.log("[TOP] Message reçu:", data);
          console.log("[TOP] Studio check:", data.studio, "vs", studio);
          
          if (data.studio && data.studio !== studio) {
            console.log("[TOP] Studio différent, ignoré");
            return;
          }
          
          var wasActive = topActive;
          topActive = !!data.active;
          
          console.log("[TOP] wasActive:", wasActive, "-> topActive:", topActive);
          console.log("[TOP] fromUser:", data.fromUser, "userName:", userName);
          
          if (topBtn) {
            if (topActive) topBtn.classList.add("btn-active");
            else topBtn.classList.remove("btn-active");
          }
          updateBackground();
          
          // Son de notification pour les autres clients (pas celui qui a pressé)
          if (!wasActive && topActive && data.fromUser !== userName) {
            console.log("[TOP] Playing notification sound");
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
            } catch(e) {
              console.error("[TOP] Sound error:", e);
            }
          } else {
            console.log("[TOP] Sound skipped:", {wasActive, topActive, fromUser: data.fromUser, userName});
          }
        }
      });

      ws.addEventListener("close", function () {
        faviconSetConnected(false); // retour bleu / rouge selon ON AIR
        setTimeout(initWebSocketChat, 5000);
      });
    }

    initWebSocketChat();
  });
})();
