(function(){
  "use strict";

  const LS_KEY="display_config_v2";

  const defaults = {
    global:{
      theme:"light",
      bumperEnabled:true,
      bumperDurationMs:7000,
      bumperMinGapMs:300,
      tickerEnabled:true,
      tickerSource:"txt",
      tickerTxtUrl:"/ticker.txt",
      tickerRssUrl:"/rss/orleans/a-la-une.xml",
      tickerRefreshMs:15000,
      weatherEnabled:true,
      weatherCity:"Orléans",
      weatherLatitude:47.9029,
      weatherLongitude:1.9093,
      weatherRefreshMs:20*60*1000
    },
    screens:[]
  };

  let cfg = loadCfg();

  const elList = document.getElementById("screens-list");
  const tpl = document.getElementById("screen-template");

  // ---- global inputs
  const gTheme = byId("g-theme");
  const gBumpEn= byId("g-bumper-enabled");
  const gBumpDur=byId("g-bumper-duration");
  const gTickerEn=byId("g-ticker-enabled");
  const gTickerSource=byId("g-ticker-source");
  const gTickerTxt=byId("g-ticker-txt-url");
  const gTickerRss=byId("g-ticker-rss-url");
  const gWeatherEn=byId("g-weather-enabled");
  const gWeatherCity=byId("g-weather-city");
  const gWeatherLat=byId("g-weather-lat");
  const gWeatherLon=byId("g-weather-lon");

  // buttons
  byId("btn-add-screen").addEventListener("click", addScreen);
  byId("btn-save-all").addEventListener("click", saveAll);
  byId("btn-open-display").addEventListener("click", ()=>window.open("display.html","_blank"));

  hydrateGlobals();
  renderScreens();

  function byId(id){return document.getElementById(id);}

  function loadCfg(){
    try{
      const raw=localStorage.getItem(LS_KEY);
      if(raw) return { ...defaults, ...JSON.parse(raw) };
    }catch(_){}
    return structuredClone(defaults);
  }

  function saveCfg(){
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  }

  function hydrateGlobals(){
    gTheme.value=cfg.global.theme;
    gBumpEn.checked=cfg.global.bumperEnabled;
    gBumpDur.value=cfg.global.bumperDurationMs;
    gTickerEn.checked=cfg.global.tickerEnabled;
    gTickerSource.value=cfg.global.tickerSource;
    gTickerTxt.value=cfg.global.tickerTxtUrl;
    gTickerRss.value=cfg.global.tickerRssUrl;
    gWeatherEn.checked=cfg.global.weatherEnabled;
    gWeatherCity.value=cfg.global.weatherCity;
    gWeatherLat.value=cfg.global.weatherLatitude;
    gWeatherLon.value=cfg.global.weatherLongitude;
  }

  function collectGlobals(){
    cfg.global.theme=gTheme.value;
    cfg.global.bumperEnabled=gBumpEn.checked;
    cfg.global.bumperDurationMs=+gBumpDur.value||7000;

    cfg.global.tickerEnabled=gTickerEn.checked;
    cfg.global.tickerSource=gTickerSource.value;
    cfg.global.tickerTxtUrl=gTickerTxt.value.trim()||"/ticker.txt";
    cfg.global.tickerRssUrl=gTickerRss.value.trim()||"/rss/orleans/a-la-une.xml";

    cfg.global.weatherEnabled=gWeatherEn.checked;
    cfg.global.weatherCity=gWeatherCity.value.trim()||"Orléans";
    cfg.global.weatherLatitude=+gWeatherLat.value||47.9029;
    cfg.global.weatherLongitude=+gWeatherLon.value||1.9093;
  }

  function newScreen(){
    const id="scr_"+Math.random().toString(36).slice(2,8);
    return {
      id,
      type:"show",
      enabled:true,
      durationMs:60000,
      source:{
        kind:"radiofrance",
        stationId:"ici_orleans",
        rssUrl:"",
        manual:{title:"",subtitle:"",text:"",image:""}
      },
      options:{}
    };
  }

  function addScreen(){
    cfg.screens.push(newScreen());
    renderScreens();
  }

  function renderScreens(){
    elList.innerHTML="";
    cfg.screens.forEach((s,idx)=>{
      const node=tpl.content.firstElementChild.cloneNode(true);
      node.dataset.id=s.id;

      const enabled=node.querySelector(".scr-enabled");
      const title=node.querySelector(".scr-title");
      const type=node.querySelector(".scr-type");
      const dur=node.querySelector(".scr-duration");
      const srcKind=node.querySelector(".scr-source-kind");
      const station=node.querySelector(".scr-station");
      const rss=node.querySelector(".scr-rss");
      const mTitle=node.querySelector(".scr-manual-title");
      const mSub=node.querySelector(".scr-manual-subtitle");
      const mText=node.querySelector(".scr-manual-text");
      const mImg=node.querySelector(".scr-manual-image");

      enabled.checked=s.enabled;
      title.textContent=`${idx+1}. ${labelForType(s.type)}`;
      type.value=s.type;
      dur.value=s.durationMs;
      srcKind.value=s.source.kind;
      station.value=s.source.stationId||"";
      rss.value=s.source.rssUrl||"";
      mTitle.value=s.source.manual?.title||"";
      mSub.value=s.source.manual?.subtitle||"";
      mText.value=s.source.manual?.text||"";
      mImg.value=s.source.manual?.image||"";

      const syncWraps=()=>toggleWraps(node, srcKind.value);
      srcKind.addEventListener("change", syncWraps);
      syncWraps();

      node.querySelector(".scr-up").addEventListener("click", ()=>{
        if(idx===0) return;
        cfg.screens.splice(idx-1,0,cfg.screens.splice(idx,1)[0]);
        renderScreens();
      });
      node.querySelector(".scr-down").addEventListener("click", ()=>{
        if(idx===cfg.screens.length-1) return;
        cfg.screens.splice(idx+1,0,cfg.screens.splice(idx,1)[0]);
        renderScreens();
      });
      node.querySelector(".scr-del").addEventListener("click", ()=>{
        cfg.screens = cfg.screens.filter(x=>x.id!==s.id);
        renderScreens();
      });
      node.querySelector(".scr-preview").addEventListener("click", ()=>{
        // on sauvegarde l'état actuel AVANT preview
        saveAll();
        window.open(`display.html?preview=${s.id}`, "_blank");
      });

      // live update title on type change
      type.addEventListener("change", ()=>{
        title.textContent=`${idx+1}. ${labelForType(type.value)}`;
      });

      elList.appendChild(node);
    });
  }

  function toggleWraps(card, kind){
    card.querySelector(".scr-station-wrap").style.display = (kind==="radiofrance")?"block":"none";
    card.querySelector(".scr-rss-wrap").style.display = (kind==="rss")?"block":"none";
    card.querySelector(".scr-manual-title-wrap").style.display = (kind==="manual")?"block":"none";
    card.querySelector(".scr-manual-subtitle-wrap").style.display = (kind==="manual")?"block":"none";
    card.querySelector(".scr-manual-text-wrap").style.display = (kind==="manual")?"block":"none";
    card.querySelector(".scr-manual-image-wrap").style.display = (kind==="manual")?"block":"none";
  }

  function collectScreensFromUI(){
    const cards=[...elList.querySelectorAll(".screen-card")];
    cfg.screens = cards.map(card=>{
      const id=card.dataset.id;
      const type=card.querySelector(".scr-type").value;
      const enabled=card.querySelector(".scr-enabled").checked;
      const durationMs=+card.querySelector(".scr-duration").value||60000;
      const kind=card.querySelector(".scr-source-kind").value;

      const stationId=card.querySelector(".scr-station").value.trim();
      const rssUrl=card.querySelector(".scr-rss").value.trim();
      const manual={
        title:card.querySelector(".scr-manual-title").value.trim(),
        subtitle:card.querySelector(".scr-manual-subtitle").value.trim(),
        text:card.querySelector(".scr-manual-text").value.trim(),
        image:card.querySelector(".scr-manual-image").value.trim(),
      };

      return {
        id,type,enabled,durationMs,
        source:{ kind, stationId, rssUrl, manual },
        options:{}
      };
    });
  }

  function saveAll(){
    collectGlobals();
    collectScreensFromUI();
    saveCfg();
    alert("✅ Configuration enregistrée");
  }

  function labelForType(t){
    return ({
      show:"Émission en cours",
      event:"Événement",
      nowplaying:"Now Playing",
      schedule:"Programme",
      podcast:"Podcast",
      rss:"RSS générique",
      manual:"Manuel",
      fullscreen:"Plein écran"
    })[t] || t;
  }

})();
