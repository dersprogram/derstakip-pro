(function(){
  // Scroll restoration — sayfa geçişinde scroll pozisyonu geri yüklenmesini engelle
  if('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  (function(){
    var stored = null; try{ stored = localStorage.getItem('appTheme'); }catch(e){}
    var isDark = stored !== 'light';
    var bg = isDark ? '#050912' : '#f4f6f9';
    var de = document.documentElement;
    de.classList.add('app-shell-active');
    de.style.overflow   = 'hidden';
    de.style.background = bg;
    var s = document.createElement('style');
    s.id = '__early_bg';
    s.textContent = 'body{background:' + bg + '!important}html.app-shell-active body:not(.app-ready):not(.loaded){visibility:hidden!important}';
    document.head.appendChild(s);
    var mList = document.querySelectorAll('meta[name="theme-color"]');
    if(mList.length === 0){ var m = document.createElement('meta'); m.name = 'theme-color'; m.content = bg; document.head.appendChild(m); }
    else { mList.forEach(function(m){ m.content = bg; }); }
  })();

  const APP_VERSION = "20260521-1";
  const THEME_KEY = "appTheme";
  const FONT_KEY = "appFontSize";
  const SETTINGS_KEY = "ayarlar";
  const DAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
  const FONT_MAP = {
    small: "13px",
    medium: "15px",
    large: "18px"
  };

  function normalizeLocalDevOrigin(){
    if(window.location.hostname !== "127.0.0.1") return;
    const targetUrl = new URL(window.location.href);
    targetUrl.hostname = "localhost";
    window.location.replace(targetUrl.toString());
  }

  normalizeLocalDevOrigin();

  function normalizeTheme(theme){
    return theme === "light" ? "light" : "dark";
  }

  function normalizeFontSize(size){
    return Object.prototype.hasOwnProperty.call(FONT_MAP, size) ? size : "medium";
  }

  function safeJsonParse(value, fallback){
    try{
      const parsed = JSON.parse(value);
      return parsed === null ? fallback : parsed;
    }catch(error){
      return fallback;
    }
  }

  // ─── Rol yönetimi ────────────────────────────────────────────────────────

  function getRole(){
    const data = safeJsonParse(localStorage.getItem(SETTINGS_KEY), null);
    return data?.settings?.role || null;
  }

  function getRoleSuffix(){
    const role = getRole();
    if(role === "student") return "-student";
    if(role === "teacher") return "-teacher";
    return "-teacher"; // fallback
  }

  // Rol seçilmemişse welcome.html'e yönlendir.
  // welcome.html ve welcome'a yönlendirmek anlamsız olan sayfalar hariç.
  function guardRoleSelection(){
    const path = window.location.pathname.toLowerCase();
    const isWelcome = path.includes("welcome");
    const isRedirecting = document.documentElement.dataset.noRoleGuard === "true";

    if(isWelcome || isRedirecting) return;

    const role = getRole();
    if(!role){
      window.location.replace("welcome.html");
    }
  }

  // ─── Custom confirm modal ────────────────────────────────────────────────

  function customConfirm(message){
    return new Promise(function(resolve){
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.68);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);padding:20px;';
      var box = document.createElement('div');
      box.style.cssText = 'background:var(--color-panel-top,#0e121c);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:24px 20px 20px;max-width:320px;width:100%;box-shadow:0 28px 64px rgba(0,0,0,.75),0 0 0 1px rgba(255,255,255,.04);';
      var msg = document.createElement('p');
      msg.style.cssText = 'margin:0 0 20px;color:var(--text-primary,#fff);font-size:.9rem;line-height:1.5;white-space:pre-line;';
      msg.textContent = message;
      var btns = document.createElement('div');
      btns.style.cssText = 'display:flex;gap:10px;';
      var cancel = document.createElement('button');
      cancel.textContent = 'İptal';
      cancel.style.cssText = 'flex:1;padding:10px;border-radius:8px;border:1px solid var(--border-strong,rgba(255,255,255,.18));background:transparent;color:var(--text-muted,rgba(255,255,255,.5));font-size:.85rem;font-weight:700;cursor:pointer;';
      var ok = document.createElement('button');
      ok.textContent = 'Tamam';
      ok.style.cssText = 'flex:1;padding:10px;border-radius:8px;border:none;background:var(--color-accent,#ff7a00);color:#000;font-size:.85rem;font-weight:900;cursor:pointer;';
      function close(result){ document.body.removeChild(overlay); resolve(result); }
      cancel.onclick = function(){ close(false); };
      ok.onclick     = function(){ close(true);  };
      btns.appendChild(cancel);
      btns.appendChild(ok);
      box.appendChild(msg);
      box.appendChild(btns);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    });
  }

  function customAlert(message){
    return new Promise(function(resolve){
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);padding:20px;';
      var box = document.createElement('div');
      box.style.cssText = 'background:var(--color-panel-top,#0e121c);border:1px solid var(--border-normal,rgba(255,255,255,.14));border-radius:14px;padding:24px 20px 20px;max-width:320px;width:100%;box-shadow:0 20px 48px rgba(0,0,0,.6);';
      var msg = document.createElement('p');
      msg.style.cssText = 'margin:0 0 20px;color:var(--text-primary,#fff);font-size:.9rem;line-height:1.5;white-space:pre-line;';
      msg.textContent = message;
      var ok = document.createElement('button');
      ok.textContent = 'Tamam';
      ok.style.cssText = 'width:100%;padding:10px;border-radius:8px;border:none;background:var(--color-accent,#ff7a00);color:#000;font-size:.85rem;font-weight:900;cursor:pointer;';
      ok.onclick = function(){ document.body.removeChild(overlay); resolve(); };
      box.appendChild(msg);
      box.appendChild(ok);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    });
  }

  // ─── Rol sıfırlama ───────────────────────────────────────────────────────

  function resetRoleAndData(){
    customConfirm("Mevcut veriler silinecek. Devam edilsin mi?").then(function(confirmed){
      if(!confirmed) return;

      // Tema ve font tercihlerini koru, geri kalanı sil
      const theme = localStorage.getItem(THEME_KEY);
      const font = localStorage.getItem(FONT_KEY);

      localStorage.clear();

      if(theme) localStorage.setItem(THEME_KEY, theme);
      if(font) localStorage.setItem(FONT_KEY, font);

      window.location.replace("welcome.html");
    });
  }

  // ─── Genel yardımcılar ───────────────────────────────────────────────────

  function getStoredTheme(){
    return normalizeTheme(localStorage.getItem(THEME_KEY) || "dark");
  }

  function getStoredFontSize(){
    return normalizeFontSize(localStorage.getItem(FONT_KEY) || "small");
  }

  function loadAppData(){
    return safeJsonParse(localStorage.getItem(SETTINGS_KEY), null);
  }

  function saveAppData(appData){
    appData.lastModified = Date.now();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(appData));
    // Eğer online ise sync.js yüklüyse Firebase'e gönder (fire-and-forget)
    if(navigator.onLine){
      pushSyncNow(appData).catch(function(){});
    }
    return appData;
  }

  var syncModulePromise = null;

  function loadSyncModule(){
    if(window.AppSync) return Promise.resolve(window.AppSync);
    if(!syncModulePromise){
      syncModulePromise = import('./sync.js').then(function(module){
        return window.AppSync || module;
      }).catch(function(error){
        syncModulePromise = null;
        throw error;
      });
    }
    return syncModulePromise;
  }

  function pushSyncNow(appData){
    if(!navigator.onLine) return Promise.resolve();
    if(window.AppSync?.pushNow) return window.AppSync.pushNow(appData);
    return loadSyncModule().then(function(sync){
      if(sync?.pushNow) return sync.pushNow(appData);
    });
  }

  function syncNow(){
    if(!navigator.onLine) return Promise.resolve();
    if(window.AppSync?.syncNow) return window.AppSync.syncNow();
    return loadSyncModule().then(function(sync){
      if(sync?.syncNow) return sync.syncNow();
    });
  }

  function isGuestUser(appData){
    return appData?.settings?.userType === "guest";
  }

  function syncAuthState(){
    if(window.AppAuth && typeof window.AppAuth.syncFromStorage === "function"){
      return window.AppAuth.syncFromStorage();
    }
    return loadAppData();
  }

  function getTodayDayIndex(){
    const mapJsToOur = [6, 0, 1, 2, 3, 4, 5];
    return mapJsToOur[new Date().getDay()];
  }

  function getTodayDayName(){
    return DAY_NAMES[getTodayDayIndex()];
  }

  function cloneRows(rows){
    return (rows || []).map(function(row){
      return Object.assign({}, row);
    });
  }

  function hashText(value){
    const text = String(value || "");
    let hash = 2166136261;
    for(let index = 0; index < text.length; index += 1){
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createSeededRandom(seed){
    let state = (Number(seed) >>> 0) || 1;
    return function(){
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function shuffledRows(rows, seedKey){
    const list = cloneRows(rows);
    if(list.length < 2) return list;
    const random = createSeededRandom(hashText(seedKey));
    for(let index = list.length - 1; index > 0; index -= 1){
      const swapIndex = Math.floor(random() * (index + 1));
      const temp = list[index];
      list[index] = list[swapIndex];
      list[swapIndex] = temp;
    }
    return list;
  }

  function getGuestSourceDayName(){
    return getTodayDayName();
  }

  function getActiveDayNames(appData){
    const activeIndexes = Array.isArray(appData?.activeDays) && appData.activeDays.length
      ? appData.activeDays
      : [0, 1, 2, 3, 4];
    return activeIndexes.map(function(index){ return DAY_NAMES[index]; }).filter(Boolean);
  }

  function isActiveDay(appData, dayName){
    const resolvedDay = String(dayName || "").trim();
    if(!resolvedDay) return false;
    return getActiveDayNames(appData).includes(resolvedDay);
  }

  function isGuestEditableDay(appData, dayName){
    return true;
  }

  function getScheduleRowsForDay(appData, dayName){
    const schedule = appData?.schedule || {};
    const resolvedDay = String(dayName || "").trim();
    const dayIsActive = isActiveDay(appData, resolvedDay);
    if(!dayIsActive) return [];
    return cloneRows(schedule[resolvedDay] || []);
  }

  // ─── Tema / font ─────────────────────────────────────────────────────────

  function applyTheme(theme, persist){
    const nextTheme = normalizeTheme(theme);
    document.documentElement.dataset.theme = nextTheme;
    if(persist !== false) localStorage.setItem(THEME_KEY, nextTheme);
    document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){ m.content = nextTheme === 'light' ? '#f4f6f9' : '#050912'; });
    syncThemeToggleButton();
    return nextTheme;
  }

  function applyFontSize(size, persist){
    const nextSize = normalizeFontSize(size);
    document.documentElement.style.setProperty("--base-font-size", FONT_MAP[nextSize]);
    if(persist !== false) localStorage.setItem(FONT_KEY, nextSize);
    const fontCtrl = document.getElementById("fontSizeCtrl");
    if(fontCtrl) fontCtrl.value = nextSize;
    return nextSize;
  }

  function toggleTheme(){
    const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    return applyTheme(nextTheme, true);
  }

  function syncThemeToggleButton(){
    const btn = document.getElementById("themeToggle");
    if(!btn) return;
    const theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const nextThemeLabel = theme === "light" ? "Koyu temaya geç" : "Açık temaya geç";
    const nextThemeIcon = theme === "light" ? "dark_mode" : "light_mode";
    btn.innerHTML = '<span class="icon" aria-hidden="true">' + nextThemeIcon + "</span>";
    btn.setAttribute("aria-label", nextThemeLabel);
    btn.setAttribute("title", nextThemeLabel);
  }

  // ─── Sayfa düzeni / görünürlük (tüm sayfalarda aynı) ─────────────────────

  function isWelcomePagePath(){
    return window.location.pathname.toLowerCase().includes("welcome");
  }

  function normalizePageLayout(){
    if(isWelcomePagePath()) return;
    const nav = document.querySelector(".nav");
    if(nav && nav.parentElement !== document.body){
      document.body.appendChild(nav);
    }
  }

  function revealAppPage(){
    if(isWelcomePagePath()) return;
    if(document.body.classList.contains("app-ready")) return;
    function show(){
      document.body.classList.add("app-ready");
      document.body.classList.add("loaded");
    }
    if(document.fonts && document.fonts.ready){
      document.fonts.ready.then(function(){
        requestAnimationFrame(function(){
          requestAnimationFrame(show);
        });
      }).catch(show);
      return;
    }
    requestAnimationFrame(function(){
      requestAnimationFrame(show);
    });
  }

  // ─── Nav ─────────────────────────────────────────────────────────────────

  function initNavActive(){
    const navItems = document.querySelectorAll(".navItem");
    if(!navItems.length) return;
    const path = location.pathname.toLowerCase();
    let current = "index";
    if(path.includes("weekly")) current = "weekly";
    else if(path.includes("notes")) current = "notes";
    else if(path.includes("settings")) current = "settings";
    navItems.forEach(function(item){
      item.classList.toggle("active", item.dataset.nav === current);
    });
  }

  function bindNavClicks(){
    const pageSuffix = "?v=" + encodeURIComponent(APP_VERSION);

    // Role göre doğru sayfayı hedefle
    const suffix = getRoleSuffix();

    const targets = {
      index:    "index"    + suffix + ".html" + pageSuffix,
      weekly:   "weekly"   + suffix + ".html" + pageSuffix,
      notes:    "notes"    + suffix + ".html?mode=list&v=" + encodeURIComponent(APP_VERSION),
      settings: "settings" + suffix + ".html" + pageSuffix
    };

    document.querySelectorAll(".navItem").forEach(function(item){
      if(item.dataset.shellBoundNav === "true") return;
      item.dataset.shellBoundNav = "true";
      item.addEventListener("click", function(){
        const next = targets[item.dataset.nav];
        if(next){
          var tc = document.querySelector('meta[name="theme-color"]');
          if(tc) tc.content = (localStorage.getItem('appTheme') === 'light') ? '#f4f6f9' : '#050912';
          location.replace(next);
        }
      });
    });
  }

  function bindThemeToggle(){
    const btn = document.getElementById("themeToggle");
    if(!btn || btn.dataset.shellBound === "true") return;
    btn.dataset.shellBound = "true";
    btn.addEventListener("click", function(){ toggleTheme(); });
    syncThemeToggleButton();
  }

  // ─── Dış navigasyon koruması ─────────────────────────────────────────────

  const EXTERNAL_NAV_ALLOWLIST = [
    "accounts.google.com",
    ".google.com",
    ".firebaseapp.com"
  ];

  function isAllowedExternalHost(hostname){
    const normalizedHost = String(hostname || "").toLowerCase();
    if(!normalizedHost) return false;
    return EXTERNAL_NAV_ALLOWLIST.some(function(allowedHost){
      if(allowedHost.startsWith(".")){
        const suffix2 = allowedHost.slice(1);
        return normalizedHost === suffix2 || normalizedHost.endsWith("." + suffix2);
      }
      return normalizedHost === allowedHost;
    });
  }

  function isBlockedExternalUrl(url){
    if(!url) return false;
    if(window.__shellExternalGuardSuspended === true) return false;
    try{
      const parsed = new URL(url, window.location.href);
      const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
      const isSameOrigin = parsed.origin === window.location.origin;
      if(!isHttp || isSameOrigin) return false;
      return !isAllowedExternalHost(parsed.hostname);
    }catch(error){
      return false;
    }
  }

  function suspendExternalNavigationGuard(){
    window.__shellExternalGuardSuspended = true;
  }

  function resumeExternalNavigationGuard(){
    window.__shellExternalGuardSuspended = false;
  }

  function bindExternalNavigationGuard(){
    if(document.documentElement.dataset.shellExternalGuard === "true") return;
    document.documentElement.dataset.shellExternalGuard = "true";
    const nativeOpen = window.open;
    if(typeof nativeOpen === "function" && window.__shellOpenPatched !== true){
      window.__shellOpenPatched = true;
      window.open = function(url){
        if(isBlockedExternalUrl(url)) return null;
        return nativeOpen.apply(window, arguments);
      };
    }
    document.addEventListener("click", function(event){
      const anchor = event.target.closest("a[href]");
      if(!anchor) return;
      const href = anchor.getAttribute("href");
      if(isBlockedExternalUrl(href)){
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  }

  function addCacheBusting(){
    if(!window.location.search.includes("devcss=1")) return;
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    links.forEach(function(link){
      const href = link.getAttribute("href");
      if(href && href.indexOf("?") === -1){
        link.setAttribute("href", href + "?t=" + Date.now());
      }
    });
  }

  // ─── Register prompt ─────────────────────────────────────────────────────

  function hideRegisterPrompt(){
    const modal = document.getElementById("registerPrompt");
    if(modal) modal.style.display = "none";
    document.body.classList.remove("modal-open");
  }

  function triggerRegisterFlow(){
    if(typeof window.goRegister === "function"){
      window.goRegister();
      return;
    }
    const suffix = getRoleSuffix();
    window.location.replace("settings" + suffix + ".html?action=showuser");
  }

  function ensureRegisterPrompt(){
    let modal = document.getElementById("registerPrompt");
    if(modal) return modal;
    modal = document.createElement("div");
    modal.id = "registerPrompt";
    modal.className = "appModalOverlay";
    modal.style.display = "none";
    modal.innerHTML = [
      '<div class="appModal registerPrompt-card" role="dialog" aria-modal="true" aria-labelledby="registerPromptTitle">',
      '<div class="registerPrompt-kicker">SINIRLI KULLANIM</div>',
      '<div class="registerPrompt-title" id="registerPromptTitle">Bu özelliğin tamamını kullanmak için kayıt olun.</div>',
      '<div class="registerPrompt-text" id="registerPromptText" style="display:none;"></div>',
      '<div class="registerPrompt-actions">',
      '<button type="button" class="registerPrompt-primary" id="registerPromptGo">Kayıt Ol</button>',
      '<button type="button" class="registerPrompt-secondary" id="registerPromptCancel">Vazgeç</button>',
      "</div>",
      "</div>"
    ].join("");
    document.body.appendChild(modal);
    modal.addEventListener("click", function(event){
      if(event.target === modal || event.target.id === "registerPromptCancel"){
        hideRegisterPrompt();
      }
      if(event.target.id === "registerPromptGo"){
        hideRegisterPrompt();
        triggerRegisterFlow();
      }
    });
    return modal;
  }

  function showRegisterPrompt(message){
    const modal = ensureRegisterPrompt();
    const text = document.getElementById("registerPromptText");
    if(text){ text.textContent = ""; text.style.display = "none"; }
    modal.style.display = "flex";
    document.body.classList.add("modal-open");
  }

  // ─── Geri tuşu yönetimi ──────────────────────────────────────────────────

  function isIndexPage(){
    const path = window.location.pathname.toLowerCase();
    return path.includes("index-");
  }

  function isWelcomePage(){
    const path = window.location.pathname.toLowerCase();
    return path.includes("welcome");
  }

  function bindBackButton(){
    if(isWelcomePage() || isIndexPage()) return;

    history.pushState({ backHandled: true }, "");

    window.addEventListener("popstate", function(){
      window.location.replace("index" + getRoleSuffix() + ".html");
    });
  }

  // ─── Init ────────────────────────────────────────────────────────────────

  // ─── PWA meta enjeksiyonu ────────────────────────────────────────────────────

  function injectPWAMeta(){
    if(!document.querySelector('link[rel="manifest"]')){
      var lnk = document.createElement('link');
      lnk.rel  = 'manifest';
      lnk.href = 'manifest.json';
      document.head.appendChild(lnk);
    }
    if(!document.querySelector('link[rel="apple-touch-icon"]')){
      var atIcon = document.createElement('link');
      atIcon.rel  = 'apple-touch-icon';
      atIcon.href = 'icons/icon-192.png';
      document.head.appendChild(atIcon);
    }
    if(!document.querySelector('meta[name="mobile-web-app-capable"]')){
      var mCap = document.createElement('meta');
      mCap.name    = 'mobile-web-app-capable';
      mCap.content = 'yes';
      document.head.appendChild(mCap);
    }
    if(!document.querySelector('meta[name="theme-color"]')){
      var mTheme = document.createElement('meta');
      mTheme.name    = 'theme-color';
      mTheme.content = '#050912';
      document.head.appendChild(mTheme);
    }
  }

  function initAppShell(){
    document.documentElement.classList.add('app-shell-active');
    window.scrollTo(0, 0);
    document.documentElement.style.overflow = '';
    document.documentElement.style.background = '';
    var early = document.getElementById('__early_bg');
    if(early) early.remove();
    // Rol guard — welcome hariç her sayfada çalışır
    guardRoleSelection();

    syncAuthState();
    addCacheBusting();
    applyTheme(getStoredTheme(), false);
    applyFontSize(getStoredFontSize(), false);
    normalizePageLayout();
    bindExternalNavigationGuard();
    bindNavClicks();
    initNavActive();
    bindThemeToggle();
    ensureRegisterPrompt();
    bindBackButton();
    injectPWAMeta();
    revealAppPage();

    // sync.js'i dinamik olarak yükle (ES module, fire-and-forget)
    syncNow().catch(function(){});
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.AppShell = {
    THEME_KEY,
    FONT_KEY,
    SETTINGS_KEY,
    DAY_NAMES,
    safeJsonParse,
    getStoredTheme,
    getStoredFontSize,
    loadAppData,
    saveAppData,
    loadSyncModule,
    syncNow,
    pushSyncNow,
    isGuestUser,
    syncAuthState,
    getTodayDayIndex,
    getTodayDayName,
    getActiveDayNames,
    isActiveDay,
    customConfirm,
    customAlert,
    getGuestSourceDayName,
    isGuestEditableDay,
    getScheduleRowsForDay,
    applyTheme,
    applyFontSize,
    toggleTheme,
    bindExternalNavigationGuard,
    suspendExternalNavigationGuard,
    resumeExternalNavigationGuard,
    bindNavClicks,
    initNavActive,
    normalizePageLayout,
    revealAppPage,
    initAppShell,
    syncThemeToggleButton,
    showRegisterPrompt,
    hideRegisterPrompt,
    triggerRegisterFlow,
    getRole,
    getRoleSuffix,
    resetRoleAndData,  // Settings'den çağrılacak
    bindBackButton
  };

  applyTheme(getStoredTheme(), false);
  applyFontSize(getStoredFontSize(), false);
  document.addEventListener("DOMContentLoaded", initAppShell);

  window.addEventListener("storage", function(event){
    if(event.key === THEME_KEY) applyTheme(event.newValue || "dark", false);
    if(event.key === FONT_KEY) applyFontSize(event.newValue || "small", false);
    if(event.key === SETTINGS_KEY) syncAuthState();
  });

  // ─── Cross-document view transition iptal ───────────────────────────────────
  // Bazı Chrome/WebView versiyonları CSS'e rağmen sağdan kayma animasyonu uygular.
  window.addEventListener("pageswap", function(e){ if(e.viewTransition) e.viewTransition.skipTransition(); });
  window.addEventListener("pagereveal", function(e){ if(e.viewTransition) e.viewTransition.skipTransition(); });

  // ─── Service Worker kaydı ────────────────────────────────────────────────────

  if("serviceWorker" in navigator && location.hostname !== "dersprogram.github.io"){
    navigator.serviceWorker.register("/sw.js").catch(function(err){
      console.warn("[SW] Kayıt hatası:", err);
    });
  }
})();
