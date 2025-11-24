/**
 * CONFIG DISPLAY
 * - lit/écrit localStorage.display_config
 * - preview iframe
 * - upload image -> base64
 * - aligné sur les clés de display.js
 */

(function(){
  "use strict";

  const LS_KEY = "display_config";

  const defaults = {
    mode: "show",
    stationId: "ici_orleans",
    refreshInterval: 30000,
    theme: "light",

    eventImage: "",
    eventTitle: "",
    eventSubtitle: "",
    eventDetails: "",

    rotationEnabled: false,
    rotationInterval: 60000,
    rotationModes: ["show","event","nowplaying","schedule","podcast"],

    autoSwitchEventEnabled: true,
    autoSwitchEventInterval: 20000,

    bumperEnabled: true,
    bumperDurationMs: 6000,
    bumperMinGapMs: 300,
    bumperShowTicker: true,

    tickerEnabled: true,
    tickerUrl: "/rss/infos.xml",
    tickerRefreshMs: 15000,
    tickerSeparator: " • ",
    tickerSpeedPxPerSec: 90,

    weatherEnabled: true,
    weatherCity: "Orléans",
    weatherLatitude: 47.9029,
    weatherLongitude: 1.9093,
    weatherRefreshMs: 20 * 60 * 1000,

    // contenus démo
    npStationTitle: "ici Orléans",
    npBaseline: "Actu locale, musique et bonne humeur",
    scheduleDemo: [
      "06:00 - 09:00 Ici Matin",
      "09:00 - 10:00 Les invités",
      "10:00 - 12:00 Musique locale"
    ].join("\n"),
  };

  let config = load();

  // ---------- helpers ----------
  function load(){
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return {...defaults};
    try{
      return {...defaults, ...JSON.parse(raw)};
    }catch(e){
      console.warn("display_config invalide, reset", e);
      return {...defaults};
    }
  }

  function save(){
    localStorage.setItem(LS_KEY, JSON.stringify(config));
  }

  function $(id){ return document.getElementById(id); }

  function bindInput(id, key, type="text"){
    const el = $(id);
    if(!el) return;

    // init UI
    if(type==="checkbox") el.checked = !!config[key];
    else el.value = config[key] ?? "";

    // update
    el.addEventListener("input", ()=>{
      if(type==="checkbox") config[key] = el.checked;
      else if(type==="number") config[key] = Number(el.value || 0);
      else config[key] = el.value;
    });
  }

  // ---------- rotation modes chips ----------
  const ALL_MODES = [
    {key:"show", label:"Émission"},
    {key:"event", label:"Événement"},
    {key:"nowplaying", label:"Now playing"},
    {key:"schedule", label:"Programme"},
    {key:"podcast", label:"Podcast"}
  ];

  function renderRotationChips(){
    const wrap = $("rotationModes");
    if(!wrap) return;
    wrap.innerHTML = "";

    ALL_MODES.forEach(m=>{
      const chip = document.createElement("div");
      chip.className = "chip " + (config.rotationModes.includes(m.key) ? "active" : "");
      chip.textContent = m.label;
      chip.addEventListener("click", ()=>{
        const list = new Set(config.rotationModes || []);
        if(list.has(m.key)) list.delete(m.key);
        else list.add(m.key);
        config.rotationModes = Array.from(list);
        renderRotationChips();
      });
      wrap.appendChild(chip);
    });
  }

  // ---------- image upload -> base64 ----------
  function fileToDataURL(file){
    return new Promise((resolve,reject)=>{
      const r = new FileReader();
      r.onload = ()=> resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function setupDrop(dropId, fileId, urlId, key){
    const drop = $(dropId);
    const fileInput = $(fileId);
    const urlInput = $(urlId);

    if(urlInput){
      urlInput.value = config[key] || "";
      urlInput.addEventListener("input", ()=>{
        config[key] = urlInput.value.trim();
      });
    }

    if(fileInput){
      fileInput.addEventListener("change", async ()=>{
        const f = fileInput.files?.[0];
        if(!f) return;
        const data = await fileToDataURL(f);
        config[key] = data;
        if(urlInput) urlInput.value = data;
      });
    }

    if(!drop) return;

    ["dragenter","dragover"].forEach(evt=>{
      drop.addEventListener(evt,(e)=>{
        e.preventDefault(); e.stopPropagation();
        drop.classList.add("drag");
      });
    });

    ["dragleave","drop"].forEach(evt=>{
      drop.addEventListener(evt,(e)=>{
        e.preventDefault(); e.stopPropagation();
        drop.classList.remove("drag");
      });
    });

    drop.addEventListener("drop", async (e)=>{
      const f = e.dataTransfer.files?.[0];
      if(!f) return;
      const data = await fileToDataURL(f);
      config[key] = data;
      if(urlInput) urlInput.value = data;
    });
  }

  // ---------- bind fields ----------
  function bindAll(){
    bindInput("theme","theme");
    bindInput("mode","mode");
    bindInput("stationId","stationId");
    bindInput("refreshInterval","refreshInterval","number");

    bindInput("rotationEnabled","rotationEnabled","checkbox");
    bindInput("rotationInterval","rotationInterval","number");

    bindInput("autoSwitchEventEnabled","autoSwitchEventEnabled","checkbox");
    bindInput("autoSwitchEventInterval","autoSwitchEventInterval","number");

    bindInput("bumperEnabled","bumperEnabled","checkbox");
    bindInput("bumperDurationMs","bumperDurationMs","number");
    bindInput("bumperMinGapMs","bumperMinGapMs","number");
    bindInput("bumperShowTicker","bumperShowTicker","checkbox");

    bindInput("tickerEnabled","tickerEnabled","checkbox");
    bindInput("tickerUrl","tickerUrl");
    bindInput("tickerRefreshMs","tickerRefreshMs","number");
    bindInput("tickerSeparator","tickerSeparator");
    bindInput("tickerSpeedPxPerSec","tickerSpeedPxPerSec","number");

    bindInput("weatherEnabled","weatherEnabled","checkbox");
    bindInput("weatherCity","weatherCity");
    bindInput("weatherLatitude","weatherLatitude","number");
    bindInput("weatherLongitude","weatherLongitude","number");
    bindInput("weatherRefreshMs","weatherRefreshMs","number");

    bindInput("eventTitle","eventTitle");
    bindInput("eventSubtitle","eventSubtitle");
    bindInput("eventDetails","eventDetails");

    bindInput("npStationTitle","npStationTitle");
    bindInput("npBaseline","npBaseline");
    bindInput("scheduleDemo","scheduleDemo");

    setupDrop("eventImageDrop","eventImageFile","eventImage","eventImage");

    renderRotationChips();
  }

  // ---------- buttons ----------
  $("btn-save")?.addEventListener("click", ()=>{
    save();
    flash("Enregistré ✅");
    reloadPreview();
  });

  $("btn-reset")?.addEventListener("click", ()=>{
    config = {...defaults};
    save();
    location.reload();
  });

  $("btn-reload-preview")?.addEventListener("click", reloadPreview);

  $("btn-open-display")?.addEventListener("click", ()=>{
    window.open("display.html","_blank");
  });

  $("btn-fullscreen-preview")?.addEventListener("click", ()=>{
    const fr = $("previewFrame");
    if(!fr) return;
    if(fr.requestFullscreen) fr.requestFullscreen();
  });

  function reloadPreview(){
    const fr = $("previewFrame");
    if(fr) fr.src = fr.src.split("?")[0] + "?t=" + Date.now();
  }

  function flash(msg){
    const b = document.createElement("div");
    b.textContent = msg;
    b.style.cssText = `
      position:fixed; right:16px; bottom:16px; z-index:9999;
      background:#001ed2; color:#fff; padding:10px 12px;
      border-radius:10px; font-weight:900; box-shadow:0 10px 30px rgba(0,0,0,.2);
    `;
    document.body.appendChild(b);
    setTimeout(()=> b.remove(), 1400);
  }

  // init
  bindAll();

})();
