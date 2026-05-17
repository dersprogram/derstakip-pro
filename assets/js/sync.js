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
// fbNotes / fbNotesTs: local not yoksa Firebase'deki notları koru (sıfırlama).

export async function pushNow(appData, fbNotes, fbNotesTs) {
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

    let finalNotes, finalNotesTs;
    if (rawNotes.length > 0) {
      if (notesTs === 0) {
        notesTs = Date.now();
        localStorage.setItem(NOTES_TS_KEY, String(notesTs));
      }
      finalNotes   = rawNotes;
      finalNotesTs = notesTs;
    } else if (Array.isArray(fbNotes) && fbNotes.length > 0) {
      // Local'de not yok — Firebase'deki notları koru
      // fbNotesTs=0 ise gerçek bir timestamp ata (sonraki sync'te çekilebilsin)
      finalNotes   = fbNotes;
      finalNotesTs = fbNotesTs || Date.now();
    } else {
      finalNotes   = [];
      finalNotesTs = 0;
    }

    const payload = {
      lessons:       data.lessons      || [],
      weeklyGrid:    data.weeklyGrid   || {},
      activeDays:    data.activeDays   || [0, 1, 2, 3, 4],
      lastModified:  data.lastModified || Date.now(),
      notes:         finalNotes,
      notesModified: finalNotesTs,
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

  try {
    if (window.AppAuth?.ready) await window.AppAuth.ready;
  } catch(e) {}

  const uid = getUid();
  if (!uid) return;

  try {
    const local  = window.AppShell.loadAppData();
    const remote = await pullFrom(uid);

    if (!remote) {
      await pushNow(local);
      return;
    }

    const localTs       = local.lastModified  || 0;
    const remoteTs      = remote.lastModified || 0;
    const localEmpty    = !Array.isArray(local.lessons) || local.lessons.length === 0;
    const remoteHasData = Array.isArray(remote.lessons) && remote.lessons.length > 0;

    const localNotesTs  = Number(localStorage.getItem(NOTES_TS_KEY) || 0);
    const remoteNotesTs = remote.notesModified || 0;
    const localNotesArr = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
    const localHasNotes = Array.isArray(localNotesArr) && localNotesArr.length > 0;
    const remoteHasNotes = Array.isArray(remote.notes) && remote.notes.length > 0;

    const remoteMainNewer  = remoteTs > localTs || (localEmpty && remoteHasData);
    // Timestamp farkına ek olarak: local'de hiç not yoksa Firebase notlarını çek
    const remoteNotesNewer = remoteHasNotes && (remoteNotesTs > localNotesTs || !localHasNotes);

    // ── Local'i güncelle (Firebase daha yeniyse) ─────────────────────────
    if (remoteMainNewer) {
      local.lessons      = remote.lessons    ?? local.lessons;
      local.weeklyGrid   = remote.weeklyGrid ?? local.weeklyGrid;
      local.activeDays   = remote.activeDays ?? local.activeDays;
      if (remote.plans)  local.plans = remote.plans;
      local.lastModified = remoteTs;
      localStorage.setItem(window.AppShell.SETTINGS_KEY, JSON.stringify(local));
      window.dispatchEvent(new CustomEvent('appDataSynced', {
        detail: { source: 'firebase', lessons: local.lessons, weeklyGrid: local.weeklyGrid }
      }));
    }

    if (remoteNotesNewer) {
      localStorage.setItem(NOTES_KEY, JSON.stringify(remote.notes));
      localStorage.setItem(NOTES_TS_KEY, String(remoteNotesTs));
      window.dispatchEvent(new CustomEvent('appDataSynced', {
        detail: { source: 'firebase', notes: remote.notes }
      }));
    }

    // ── Firebase'i güncelle (local daha yeniyse) ─────────────────────────
    // Her iki taraftan daha yeni olan var mı?
    if (!remoteMainNewer || !remoteNotesNewer) {
      // pushNow'a Firebase notlarını yedek olarak ver:
      // local'de not yoksa Firebase'deki notlar silinmez.
      await pushNow(local, remote.notes, remote.notesModified);
    }

  } catch(e) {
    console.warn('[sync]', e);
  }
}

// ─── Başlat ──────────────────────────────────────────────────────────────────

window.AppSync = { syncNow, pushNow };

syncNow();
window.addEventListener('online', syncNow);
