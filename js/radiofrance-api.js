/**
 * Module API Radio France - GraphQL Client
 * Documentation: https://developers.radiofrance.fr/doc/
 */

(function (window) {
  'use strict';

  const API_ENDPOINT = 'https://openapi.radiofrance.fr/v1/graphql';
  
  // Configuration - Token à remplir une fois reçu
  let API_TOKEN = localStorage.getItem('radiofrance_api_token') || '';
  
  // IDs des stations ici
  const STATIONS = {
    'ici_orleans': '39',
    'ici_paris': '7',
    'ici_lyon': '31',
    // Ajoutez d'autres stations au besoin
  };

  // Cache pour éviter les appels répétés
  const cache = {
    data: {},
    ttl: {},
    get: function(key, maxAge = 30000) {
      const now = Date.now();
      if (this.data[key] && this.ttl[key] && (now - this.ttl[key]) < maxAge) {
        return this.data[key];
      }
      return null;
    },
    set: function(key, value) {
      this.data[key] = value;
      this.ttl[key] = Date.now();
    },
    clear: function() {
      this.data = {};
      this.ttl = {};
    }
  };

  /**
   * Configuration du token API
   */
  function setToken(token) {
    API_TOKEN = token;
    localStorage.setItem('radiofrance_api_token', token);
    cache.clear();
  }

  function getToken() {
    return API_TOKEN;
  }

  function hasToken() {
    return !!API_TOKEN;
  }

  /**
   * Mode démo - Données de test sans token
   */
  let DEMO_MODE = localStorage.getItem('radiofrance_demo_mode') === 'true';
  
  function setDemoMode(enabled) {
    DEMO_MODE = enabled;
    localStorage.setItem('radiofrance_demo_mode', enabled ? 'true' : 'false');
  }
  
  function getDemoData(type) {
    const now = Date.now();
    const startTime = now - 3600000; // Il y a 1h
    const endTime = now + 3600000;   // Dans 1h
    
    const demoData = {
      station: {
        id: '39',
        title: 'ici Orléans',
        baseline: 'La radio locale de l\'Orléans',
        liveStream: 'https://icecast.radiofrance.fr/fblorleans-midfi.mp3',
        colors: { primary: '#0078d4' }
      },
      show: {
        id: 'demo-show',
        title: 'Émission de démo',
        standFirst: 'Ceci est une émission de démonstration en attendant le token API Radio France.',
        published_date_timestamp: startTime,
        end_date_timestamp: endTime,
        visual: {
          src: 'https://via.placeholder.com/400x400/0078d4/ffffff?text=ici+Orleans'
        },
        personalitiesConnection: {
          edges: [
            { node: { name: 'Animateur Demo' } }
          ]
        }
      },
      schedule: [
        {
          title: 'Émission suivante',
          published_date_timestamp: endTime,
          end_date_timestamp: endTime + 7200000
        },
        {
          title: 'Après-midi musical',
          published_date_timestamp: endTime + 7200000,
          end_date_timestamp: endTime + 10800000
        }
      ]
    };
    
    return demoData[type] || null;
  }

  /**
   * Requête GraphQL générique
   */
  async function graphqlRequest(query, variables = {}) {
    if (!API_TOKEN) {
      console.warn('[RadioFrance API] Token API non configuré - Mode démo actif');
      return null;
    }

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-token': API_TOKEN
        },
        body: JSON.stringify({
          query,
          variables
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        console.error('[RadioFrance API] GraphQL errors:', result.errors);
        return null;
      }

      return result.data;
    } catch (error) {
      console.error('[RadioFrance API] Request failed:', error);
      return null;
    }
  }

  /**
   * Récupère les infos de la station
   */
  async function getStationInfo(stationId = STATIONS.ici_orleans) {
    const cacheKey = `station_${stationId}`;
    const cached = cache.get(cacheKey, 3600000); // 1h de cache
    if (cached) return cached;

    // Mode démo
    if (DEMO_MODE || !API_TOKEN) {
      return getDemoData('station');
    }

    const query = `
      query GetStation($id: ID!) {
        brand(id: $id) {
          id
          title
          baseline
          description
          websiteUrl
          liveStream
          playerUrl
          colors {
            primary
            secondary
          }
          visual {
            src
            legend
          }
        }
      }
    `;

    const data = await graphqlRequest(query, { id: stationId });
    if (data && data.brand) {
      cache.set(cacheKey, data.brand);
      return data.brand;
    }
    return null;
  }

  /**
   * Récupère l'émission en cours
   */
  async function getCurrentShow(stationId = STATIONS.ici_orleans) {
    const cacheKey = `current_show_${stationId}`;
    const cached = cache.get(cacheKey, 30000); // 30s de cache
    if (cached) return cached;

    // Mode démo
    if (DEMO_MODE || !API_TOKEN) {
      return getDemoData('show');
    }

    const now = new Date().toISOString();
    
    const query = `
      query GetCurrentShow($id: ID!, $start: DateTime!) {
        brand(id: $id) {
          id
          diffusionsOfDayByDay(day: $start) {
            edges {
              node {
                id
                title
                standFirst
                url
                published_date
                published_date_timestamp
                end_date_timestamp
                show {
                  id
                  title
                  standFirst
                  url
                  diffusionsConnection {
                    edges {
                      node {
                        title
                      }
                    }
                  }
                }
                personalitiesConnection {
                  edges {
                    node {
                      id
                      name
                    }
                  }
                }
                visual {
                  src
                  legend
                }
              }
            }
          }
        }
      }
    `;

    const data = await graphqlRequest(query, { id: stationId, start: now });
    
    if (data && data.brand && data.brand.diffusionsOfDayByDay) {
      const diffusions = data.brand.diffusionsOfDayByDay.edges;
      const nowTimestamp = Date.now() / 1000;
      
      // Trouver l'émission en cours
      const currentShow = diffusions.find(edge => {
        const startTime = edge.node.published_date_timestamp;
        const endTime = edge.node.end_date_timestamp;
        return startTime <= nowTimestamp && nowTimestamp <= endTime;
      });

      if (currentShow) {
        const show = currentShow.node;
        cache.set(cacheKey, show);
        return show;
      }
    }
    
    return null;
  }

  /**
   * Récupère le titre en cours (Now Playing)
   * Note: Cette API peut ne pas être disponible sur toutes les stations
   */
  async function getNowPlaying(stationId = STATIONS.ici_orleans) {
    const cacheKey = `now_playing_${stationId}`;
    const cached = cache.get(cacheKey, 10000); // 10s de cache
    if (cached) return cached;

    const query = `
      query GetNowPlaying($id: ID!) {
        brand(id: $id) {
          id
          liveStream
          webRadio {
            liveStream
            playerUrl
          }
        }
      }
    `;

    const data = await graphqlRequest(query, { id: stationId });
    
    if (data && data.brand) {
      // L'API Radio France ne fournit pas directement le titre en cours
      // On retourne les infos de streaming disponibles
      const result = {
        streamUrl: data.brand.liveStream || (data.brand.webRadio && data.brand.webRadio.liveStream),
        playerUrl: data.brand.webRadio && data.brand.webRadio.playerUrl,
        // Les métadonnées du titre en cours devront être obtenues via d'autres moyens
        // (streaming metadata, ou API spécifique si disponible)
      };
      
      cache.set(cacheKey, result);
      return result;
    }
    
    return null;
  }

  /**
   * Récupère le programme du jour
   */
  async function getTodaySchedule(stationId = STATIONS.ici_orleans) {
    const cacheKey = `schedule_${stationId}_${new Date().toDateString()}`;
    const cached = cache.get(cacheKey, 300000); // 5min de cache
    if (cached) return cached;

    // Mode démo
    if (DEMO_MODE || !API_TOKEN) {
      return getDemoData('schedule');
    }

    const today = new Date().toISOString().split('T')[0];
    
    const query = `
      query GetSchedule($id: ID!, $date: DateTime!) {
        brand(id: $id) {
          id
          diffusionsOfDayByDay(day: $date) {
            edges {
              node {
                id
                title
                standFirst
                url
                published_date
                published_date_timestamp
                end_date_timestamp
                show {
                  id
                  title
                  url
                }
                personalitiesConnection {
                  edges {
                    node {
                      name
                    }
                  }
                }
                visual {
                  src
                  legend
                }
              }
            }
          }
        }
      }
    `;

    const data = await graphqlRequest(query, { id: stationId, date: today });
    
    if (data && data.brand && data.brand.diffusionsOfDayByDay) {
      const schedule = data.brand.diffusionsOfDayByDay.edges.map(edge => edge.node);
      cache.set(cacheKey, schedule);
      return schedule;
    }
    
    return [];
  }

  /**
   * Récupère les prochaines émissions
   */
  async function getUpcomingShows(stationId = STATIONS.ici_orleans, limit = 3) {
    const schedule = await getTodaySchedule(stationId);
    if (!schedule || schedule.length === 0) return [];

    const nowTimestamp = Date.now() / 1000;
    
    return schedule
      .filter(show => show.published_date_timestamp > nowTimestamp)
      .slice(0, limit);
  }

  /**
   * Formate une durée en secondes vers HH:MM
   */
  function formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Calcule le pourcentage de progression d'une émission
   */
  function getShowProgress(startTimestamp, endTimestamp) {
    const now = Date.now() / 1000;
    const total = endTimestamp - startTimestamp;
    const elapsed = now - startTimestamp;
    return Math.max(0, Math.min(100, (elapsed / total) * 100));
  }

  // Export de l'API publique
  window.RadioFranceAPI = {
    // Configuration
    setToken,
    getToken,
    hasToken,
    setDemoMode,
    STATIONS,
    
    // Requêtes
    getStationInfo,
    getCurrentShow,
    getNowPlaying,
    getTodaySchedule,
    getUpcomingShows,
    
    // Utilitaires
    formatTime,
    getShowProgress,
    clearCache: () => cache.clear(),
    
    // Accès direct pour requêtes custom
    graphqlRequest
  };

})(window);
