// sync.js — Firebase Realtime Database ile local-first senkronizasyon
// Senkronize edilenler: lessons, weeklyGrid, activeDays, notes
// Misafir kullanıcılar için senkronizasyon yapılmaz.

const DB_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

const NOTES_KEY    = 'app_notes';
const NOTES_TS_KEY = 'app_notes_ts';

let _db   = null;
let _ops  = null;

async function ensureDb() {
  if (_db) return;
  const [dbMod, { app }] = await Promise.all([
    import(DB_SDK),
    import('./firebase.js'),
  ]);
  _db  = dbMod.getDatabase(app);
  _ops = { ref: dbMod.ref, get: dbMod.get, set: dbMod.set };
}

// ─── Uid yardımcısı ──────────────────────────────────────────────────────────

function getUid() {
  const data = window.AppShell?.loadAppData?.();
  if (!data) return null;
  if (window.AppShell?.isGuestUser?.(data)) return null;
  return data.settings?.firebaseUid || null;
}

// ─── Firebase'e yaz ──────────────────────────────────────────────────────────

export async function pushNow(appData) {
  if (!navigator.onLine) return;
  const data = appData || window.AppShell?.loadAppData?.();
  if (!data) return;
  const uid = data.settings?.firebaseUid || getUid();
  if (!uid) return;

  try {
    await ensureDb();
    const { ref, set } = _ops;
    const rawNotes = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
    let notesTs    = Number(localStorage.getItem(NOTES_TS_KEY) || 0);
    if (notesTs === 0 && rawNotes.length > 0) {
      // Eski notlar timestamp olmadan kaydedilmiş — şimdi ata
      notesTs = Date.now();
      localStorage.setItem(NOTES_TS_KEY, String(notesTs));
    }
    const payload = {
      lessons:       data.lessons      || [],
      weeklyGrid:    data.weeklyGrid   || {},
      activeDays:    data.activeDays   || [0, 1, 2, 3, 4],
      lastModified:  data.lastModified || Date.now(),
      notes:         rawNotes,
      notesModified: notesTs,
    };
    if (data.plans) payload.plans = data.plans;
    await set(ref(_db, 'users/' + uid), payload);
  } catch(e) {
    console.warn('[sync] push hatası:', e);
  }
}

// ─── Firebase'den oku ────────────────────────────────────────────────────────

async function pullFrom(uid) {
  await ensureDb();
  const { ref, get } = _ops;
  const snap = await get(ref(_db, 'users/' + uid));
  return snap.exists() ? snap.val() : null;
}

// ─── Ana senkronizasyon ──────────────────────────────────────────────────────

export async function syncNow() {
  if (!navigator.onLine) return;

  // Firebase auth hazır olana kadar bekle
  try {
    if (window.AppAuth?.ready) await window.AppAuth.ready;
  } catch(e) { /* auth hatası — gene de dene */ }

  const uid = getUid();
  if (!uid) return; // misafir, senkronizasyon yok

  try {
    const local  = window.AppShell.loadAppData();
    const remote = await pullFrom(uid);

    if (!remote) {
      // Firebase'de hiç veri yok → local'i yükle
      const withTs = Object.assign({}, local, {
        lastModified: local.lastModified || Date.now(),
      });
      await pushNow(withTs);
      return;
    }

    const localTs       = local.lastModified  || 0;
    const remoteTs      = remote.lastModified || 0;
    const localEmpty    = !Array.isArray(local.lessons) || local.lessons.length === 0;
    const remoteHasData = Array.isArray(remote.lessons) && remote.lessons.length > 0;

    let didPush = false;

    if (remoteTs > localTs || (localEmpty && remoteHasData)) {
      // Firebase daha yeni → local'i güncelle
      local.lessons      = remote.lessons    ?? local.lessons;
      local.weeklyGrid   = remote.weeklyGrid ?? local.weeklyGrid;
      local.activeDays   = remote.activeDays ?? local.activeDays;
      if (remote.plans)  local.plans = remote.plans;
      local.lastModified = remoteTs;

      // saveAppData'yı çağırmak yerine doğrudan yaz — push döngüsünü önler
      localStorage.setItem(window.AppShell.SETTINGS_KEY, JSON.stringify(local));

      // Sayfayı bilgilendir; sayfalar kendi içinde dinleyip UI'ı yenileyebilir
      window.dispatchEvent(new CustomEvent('appDataSynced', {
        detail: { source: 'firebase', lessons: local.lessons, weeklyGrid: local.weeklyGrid }
      }));

    } else {
      // Local daha yeni ya da aynı → Firebase'e gönder (notlar da dahil)
      await pushNow(local);
      didPush = true;
    }

    // Notları bağımsız olarak senkronize et (ayrı timestamp)
    const localNotesTs  = Number(localStorage.getItem(NOTES_TS_KEY) || 0);
    const remoteNotesTs = remote.notesModified || 0;
    const localNotes    = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');

    if (remoteNotesTs > localNotesTs && Array.isArray(remote.notes) && remote.notes.length > 0) {
      // Firebase notları daha yeni → local'i güncelle
      localStorage.setItem(NOTES_KEY, JSON.stringify(remote.notes));
      localStorage.setItem(NOTES_TS_KEY, String(remoteNotesTs));
      window.dispatchEvent(new CustomEvent('appDataSynced', {
        detail: { source: 'firebase', notes: remote.notes }
      }));
    } else if (!didPush && localNotes.length > 0) {
      // Ana veri pull edildi ama local'de not var, Firebase'de yok → notları gönder
      await pushNow(local);
    }

  } catch(e) {
    console.warn('[sync]', e);
  }
}

// ─── Başlat ──────────────────────────────────────────────────────────────────

window.AppSync = { syncNow, pushNow };

// İlk yüklenişte senkronize et
syncNow();

// İnternet bağlantısı gelince senkronize et
window.addEventListener('online', syncNow);
