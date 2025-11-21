/**
 * DISPLAY.JS - Logique d'affichage dynamique
 * Gère les différents modes d'affichage (émission, événement, now playing, programme)
 */

(function() {
  'use strict';

  const mainContainer = document.getElementById('display-main');
  
  // Configuration par défaut (sera surchargée par localStorage)
  let config = {
    mode: 'show', // 'show', 'event', 'nowplaying', 'schedule'
    stationId: RadioFranceAPI.STATIONS.ici_orleans,
    refreshInterval: 30000, // 30 secondes
    theme: 'dark',
    eventImage: '',
    eventTitle: '',
    eventSubtitle: '',
    eventDetails: '',
    rotationEnabled: false,
    rotationInterval: 60000, // 60 secondes
    rotationModes: ['show', 'nowplaying', 'schedule'],
    // Nouvelle option : rotation API/Événement
    autoSwitchEventEnabled: true,
    autoSwitchEventInterval: 20000 // 20 secondes par défaut
  };
  
  let currentDisplayMode = 'show'; // Mode actuellement affiché
  let rotationTimer = null;
  let autoSwitchTimer = null;

  // Chargement de la config depuis localStorage
  function loadConfig() {
    const saved = localStorage.getItem('display_config');
    if (saved) {
      try {
        config = { ...config, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Erreur chargement config:', e);
      }
    }
    
    // Activer le mode démo si pas de token
    if (!RadioFranceAPI.hasToken()) {
      console.info('Mode démo activé (pas de token API Radio France)');
      RadioFranceAPI.setDemoMode(true);
    }
    
    // Appliquer le thème
    document.body.className = `theme-${config.theme}`;
  }

  // Sauvegarde de la config
  function saveConfig() {
    localStorage.setItem('display_config', JSON.stringify(config));
  }

  // Mise à jour de la config depuis l'extérieur
  window.updateDisplayConfig = function(newConfig) {
    config = { ...config, ...newConfig };
    saveConfig();
    if (newConfig.theme) {
      document.body.className = `theme-${newConfig.theme}`;
    }
    render();
  };

  // ============== RENDU MODE: ÉMISSION ==============
  
  async function renderShowMode() {
    const show = await RadioFranceAPI.getCurrentShow(config.stationId);
    
    if (!show) {
      mainContainer.innerHTML = `
        <div class="mode-show">
          <div class="show-info">
            <div class="show-title">Aucune émission en cours</div>
            <div class="show-description">Les données ne sont pas disponibles pour le moment.</div>
          </div>
        </div>
      `;
      return;
    }

    const hosts = show.personalitiesConnection?.edges
      ?.map(edge => edge.node.name)
      .join(', ') || '';
    
    const visualSrc = show.visual?.src || show.show?.visual?.src || '';
    const startTime = show.published_date_timestamp;
    const endTime = show.end_date_timestamp;
    const progress = RadioFranceAPI.getShowProgress(startTime, endTime);

    mainContainer.innerHTML = `
      <div class="mode-show">
        <div class="show-visual-container">
          <img class="show-visual" src="${visualSrc}" alt="${show.title}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 400%22%3E%3Crect fill=%22%23102467%22 width=%22400%22 height=%22400%22/%3E%3C/svg%3E'" />
          <div class="show-visual-overlay"></div>
        </div>
        
        <div class="show-info">
          <div class="show-category">En direct</div>
          <h1 class="show-title">${show.title || show.show?.title || 'Émission'}</h1>
          ${hosts ? `<div class="show-host">avec ${hosts}</div>` : ''}
          ${show.standFirst ? `<div class="show-description">${show.standFirst}</div>` : ''}
          
          <div class="show-time-info">
            <div class="show-time">
              ${RadioFranceAPI.formatTime(startTime)} - ${RadioFranceAPI.formatTime(endTime)}
            </div>
            <div class="show-progress">
              <div class="show-progress-bar" style="width: ${progress}%"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ============== RENDU MODE: ÉVÉNEMENT ==============
  
  function renderEventMode() {
    const img = config.eventImage 
      ? `<img class="event-image" src="${config.eventImage}" alt="${config.eventTitle}" />`
      : '';

    mainContainer.innerHTML = `
      <div class="mode-event">
        <div class="event-card">
          ${img}
          <h1 class="event-title">${config.eventTitle || 'Événement à venir'}</h1>
          ${config.eventSubtitle ? `<div class="event-subtitle">${config.eventSubtitle}</div>` : ''}
          ${config.eventDetails ? `<div class="event-details">${config.eventDetails}</div>` : ''}
        </div>
      </div>
    `;
  }

  // ============== RENDU MODE: NOW PLAYING ==============
  
  async function renderNowPlayingMode() {
    // Pour l'instant, affichage basique en attendant les métadonnées du stream
    // Idéalement, on récupérerait les infos depuis le backend ou stream metadata
    
    mainContainer.innerHTML = `
      <div class="mode-nowplaying">
        <div class="np-cover-wrapper">
          <img class="np-cover" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'%3E%3Crect fill='%23102467' width='400' height='400'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23fff' font-size='60' font-family='system-ui'%3E🎵%3C/text%3E%3C/svg%3E" alt="Now Playing" />
          <div class="np-vinyl-effect"></div>
        </div>
        
        <div class="np-info">
          <div class="np-track-title">En écoute sur ici Orléans</div>
          <div class="np-track-artist">Suivez-nous en direct</div>
          <div class="np-track-album">Musique, info et divertissement</div>
        </div>
      </div>
    `;

    // TODO: Intégrer avec votre backend clock-onair pour récupérer le Now Playing réel
    // Exemple d'intégration:
    /*
    try {
      const npResponse = await fetch('/api/nowplaying');
      const npData = await npResponse.json();
      if (npData.ok && npData.nowPlaying) {
        const np = npData.nowPlaying;
        // Mettre à jour l'affichage avec les vraies données
        document.querySelector('.np-track-title').textContent = np.title || 'Titre inconnu';
        document.querySelector('.np-track-artist').textContent = np.artist || 'Artiste inconnu';
        if (np.album) {
          document.querySelector('.np-track-album').textContent = np.album;
        }
      }
    } catch (e) {
      console.error('Erreur récupération Now Playing:', e);
    }
    */
  }

  // ============== RENDU MODE: PROGRAMME ==============
  
  async function renderScheduleMode() {
    const schedule = await RadioFranceAPI.getUpcomingShows(config.stationId, 5);
    
    if (!schedule || schedule.length === 0) {
      mainContainer.innerHTML = `
        <div class="mode-schedule">
          <div class="schedule-header">
            <h1 class="schedule-title">Programme du jour</h1>
          </div>
          <div class="schedule-list">
            <div class="schedule-item">
              <div class="schedule-content">
                <div class="schedule-show-title">Aucune émission programmée</div>
              </div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const now = Date.now() / 1000;
    const today = new Date().toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });

    const scheduleHTML = schedule.map(show => {
      const startTime = show.published_date_timestamp;
      const endTime = show.end_date_timestamp;
      const duration = Math.round((endTime - startTime) / 60);
      const isCurrent = startTime <= now && now <= endTime;
      const hosts = show.personalitiesConnection?.edges
        ?.map(edge => edge.node.name)
        .join(', ') || '';

      return `
        <div class="schedule-item ${isCurrent ? 'current' : ''}">
          <div class="schedule-time-block">
            <div class="schedule-time">${RadioFranceAPI.formatTime(startTime)}</div>
            <div class="schedule-duration">${duration} min</div>
          </div>
          <div class="schedule-content">
            <div class="schedule-show-title">${show.title || show.show?.title || 'Émission'}</div>
            ${hosts ? `<div class="schedule-show-host">${hosts}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    mainContainer.innerHTML = `
      <div class="mode-schedule">
        <div class="schedule-header">
          <h1 class="schedule-title">Programme du jour</h1>
          <div class="schedule-date">${today}</div>
        </div>
        <div class="schedule-list">
          ${scheduleHTML}
        </div>
      </div>
    `;
  }

  // ============== RENDU PRINCIPAL ==============
  
  async function render() {
    mainContainer.style.opacity = '0';
    
    setTimeout(async () => {
      // Utiliser currentDisplayMode pour la bascule auto, sinon config.mode
      const modeToRender = config.autoSwitchEventEnabled && hasEventConfigured() 
        ? currentDisplayMode 
        : config.mode;
      
      switch (modeToRender) {
        case 'show':
          await renderShowMode();
          break;
        case 'event':
          renderEventMode();
          break;
        case 'nowplaying':
          await renderNowPlayingMode();
          break;
        case 'schedule':
          await renderScheduleMode();
          break;
        default:
          await renderShowMode();
      }
      
      setTimeout(() => {
        mainContainer.style.opacity = '1';
      }, 50);
    }, 300);
  }

  // ============== ROTATION AUTOMATIQUE ==============
  
  let rotationIndex = 0;

  function startRotation() {
    if (!config.rotationEnabled || config.rotationModes.length === 0) {
      return;
    }

    stopRotation();
    
    rotationTimer = setInterval(() => {
      rotationIndex = (rotationIndex + 1) % config.rotationModes.length;
      config.mode = config.rotationModes[rotationIndex];
      render();
    }, config.rotationInterval);
  }

  function stopRotation() {
    if (rotationTimer) {
      clearInterval(rotationTimer);
      rotationTimer = null;
    }
  }

  // ============== BASCULE AUTO API / ÉVÉNEMENT ==============
  
  function hasEventConfigured() {
    return !!(config.eventTitle && config.eventTitle.trim());
  }
  
  function startAutoSwitch() {
    stopAutoSwitch();
    
    // Ne démarrer que si un événement est configuré
    if (!hasEventConfigured()) {
      console.log('[Display] Pas d\'événement configuré, bascule auto désactivée');
      currentDisplayMode = 'show';
      return;
    }
    
    if (!config.autoSwitchEventEnabled) {
      console.log('[Display] Bascule auto événement désactivée dans config');
      return;
    }
    
    console.log('[Display] Bascule auto activée : API ↔ Événement toutes les', config.autoSwitchEventInterval / 1000, 'secondes');
    
    // Démarrer avec l'API
    currentDisplayMode = 'show';
    
    autoSwitchTimer = setInterval(() => {
      // Basculer entre show et event
      if (currentDisplayMode === 'show') {
        currentDisplayMode = 'event';
        console.log('[Display] → Basculement vers ÉVÉNEMENT');
      } else {
        currentDisplayMode = 'show';
        console.log('[Display] → Basculement vers API RADIO FRANCE');
      }
      
      render();
    }, config.autoSwitchEventInterval);
  }
  
  function stopAutoSwitch() {
    if (autoSwitchTimer) {
      clearInterval(autoSwitchTimer);
      autoSwitchTimer = null;
    }
  }

  // ============== RAFRAÎCHISSEMENT AUTO ==============
  
  let refreshTimer = null;

  function startAutoRefresh() {
    stopAutoRefresh();
    
    refreshTimer = setInterval(() => {
      // Rafraîchir uniquement si on est en mode API
      if (currentDisplayMode === 'show') {
        render();
      }
    }, config.refreshInterval);
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  // ============== INITIALISATION ==============
  
  function init() {
    loadConfig();
    render();
    startAutoRefresh();
    
    // Priorité : bascule auto événement si activée et événement configuré
    if (config.autoSwitchEventEnabled && hasEventConfigured()) {
      console.log('[Display] Mode bascule auto API/Événement activé');
      startAutoSwitch();
    } else if (config.rotationEnabled) {
      console.log('[Display] Mode rotation multi-modes activé');
      startRotation();
    }

    // Message de console pour debug
    console.log('[Display] Initialisé en mode:', config.mode);
    console.log('[Display] Événement configuré:', hasEventConfigured() ? 'Oui' : 'Non');
    console.log('[Display] Bascule auto événement:', config.autoSwitchEventEnabled ? 'Activée' : 'Désactivée');
    console.log('[Display] Token API Radio France:', RadioFranceAPI.hasToken() ? 'Configuré' : 'Non configuré');
    
    if (!RadioFranceAPI.hasToken()) {
      console.warn('[Display] ⚠️  Token API Radio France manquant. Configurez-le via: RadioFranceAPI.setToken("votre-token")');
    }
  }

  // Démarrage
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export pour accès externe
  window.DisplayController = {
    render,
    setMode: (mode) => {
      config.mode = mode;
      saveConfig();
      render();
    },
    getConfig: () => ({ ...config }),
    startRotation,
    stopRotation,
    startAutoRefresh,
    stopAutoRefresh,
    startAutoSwitch,
    stopAutoSwitch,
    hasEventConfigured
  };

})();
