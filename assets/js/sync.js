// sync.js — Firebase Realtime Database ile local-first senkronizasyon
// Senkronize edilenler: lessons, weeklyGrid, activeDays, notes
// Misafir kullanıcılar için senkronizasyon yapılmaz.

const DB_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

const NOTES_KEY    = 'app_notes';
const NOTES_TS_KEY = 'app_notes_ts';
const NOTES_UID_KEY = 'app_notes_uid';
const NOTES_DIRTY_KEY = 'app_notes_dirty';

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

function normalizeNotes(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => value[key])
      .filter(Boolean);
  }
  return [];
}

function readLocalNotes(uid) {
  const notes = normalizeNotes(JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'));
  const ownerUid = localStorage.getItem(NOTES_UID_KEY) || '';
  const belongsToCurrentUser = !ownerUid || ownerUid === uid;
  return {
    notes: belongsToCurrentUser ? notes : [],
    hasForeignNotes: !!ownerUid && ownerUid !== uid,
    dirty: belongsToCurrentUser && localStorage.getItem(NOTES_DIRTY_KEY) === '1',
    ts: belongsToCurrentUser ? Number(localStorage.getItem(NOTES_TS_KEY) || 0) : 0
  };
}

function writeLocalNotes(uid, notes, modified) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(normalizeNotes(notes)));
  localStorage.setItem(NOTES_TS_KEY, String(modified || 0));
  if (uid) localStorage.setItem(NOTES_UID_KEY, uid);
  localStorage.removeItem(NOTES_DIRTY_KEY);
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
    const { ref, get, set } = _ops;
    const remoteSnap = await get(ref(_db, 'users/' + uid));
    const remote = remoteSnap.exists() ? remoteSnap.val() : null;

    const localNotes = readLocalNotes(uid);
    const rawNotes = localNotes.notes;
    let notesTs    = localNotes.ts;
    const fallbackNotes = normalizeNotes(fbNotes);
    const remoteNotes = normalizeNotes(remote?.notes);

    let finalNotes, finalNotesTs;
    if (rawNotes.length > 0) {
      if (notesTs === 0) {
        notesTs = Date.now();
        localStorage.setItem(NOTES_TS_KEY, String(notesTs));
      }
      finalNotes   = rawNotes;
      finalNotesTs = notesTs;
      localStorage.setItem(NOTES_UID_KEY, uid);
    } else if (localNotes.dirty && notesTs > 0 && !localNotes.hasForeignNotes) {
      finalNotes   = [];
      finalNotesTs = notesTs;
      localStorage.setItem(NOTES_UID_KEY, uid);
    } else if (fallbackNotes.length > 0) {
      // Local'de not yok — Firebase'deki notları koru
      // fbNotesTs=0 ise gerçek bir timestamp ata (sonraki sync'te çekilebilsin)
      finalNotes   = fallbackNotes;
      finalNotesTs = fbNotesTs || Date.now();
      writeLocalNotes(uid, finalNotes, finalNotesTs);
    } else if (remoteNotes.length > 0 && !localNotes.dirty) {
      finalNotes   = remoteNotes;
      finalNotesTs = remote?.notesModified || Date.now();
      writeLocalNotes(uid, finalNotes, finalNotesTs);
    } else {
      finalNotes   = [];
      finalNotesTs = 0;
      if (localNotes.hasForeignNotes) writeLocalNotes(uid, [], 0);
    }

    const localHasMain = Array.isArray(data.lessons) && data.lessons.length > 0;
    const remoteHasMain = Array.isArray(remote?.lessons) && remote.lessons.length > 0;
    const preserveRemoteMain = !localHasMain && remoteHasMain;

    const payload = {
      lessons:       preserveRemoteMain ? remote.lessons : (data.lessons || []),
      weeklyGrid:    preserveRemoteMain ? (remote.weeklyGrid || {}) : (data.weeklyGrid || {}),
      activeDays:    preserveRemoteMain ? (remote.activeDays || [0, 1, 2, 3, 4]) : (data.activeDays || [0, 1, 2, 3, 4]),
      lastModified:  preserveRemoteMain ? (remote.lastModified || data.lastModified || Date.now()) : (data.lastModified || Date.now()),
      notes:         finalNotes,
      notesModified: finalNotesTs,
    };
    if (preserveRemoteMain && remote.plans) payload.plans = remote.plans;
    else if (data.plans) payload.plans = data.plans;

    await set(ref(_db, 'users/' + uid), payload);
    localStorage.removeItem(NOTES_DIRTY_KEY);
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

    const localNotes = readLocalNotes(uid);
    const localNotesTs  = localNotes.ts;
    const remoteNotesTs = remote.notesModified || 0;
    const localNotesArr = localNotes.notes;
    const localHasNotes = Array.isArray(localNotesArr) && localNotesArr.length > 0;
    const remoteNotesArr = normalizeNotes(remote.notes);
    const remoteHasNotes = remoteNotesArr.length > 0;

    const remoteMainNewer  = remoteTs > localTs || (localEmpty && remoteHasData);
    // Timestamp farkına ek olarak: local'de hiç not yoksa Firebase notlarını çek
    const remoteNotesNewer =
      remoteNotesTs > localNotesTs ||
      (remoteHasNotes && !localHasNotes && !localNotes.dirty) ||
      localNotes.hasForeignNotes;

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
      writeLocalNotes(uid, remoteNotesArr, remoteNotesTs);
      window.dispatchEvent(new CustomEvent('appDataSynced', {
        detail: { source: 'firebase', notes: remoteNotesArr }
      }));
    }

    // ── Firebase'i güncelle (local daha yeniyse) ─────────────────────────
    // Her iki taraftan daha yeni olan var mı?
    if (!remoteMainNewer || !remoteNotesNewer) {
      // pushNow'a Firebase notlarını yedek olarak ver:
      // local'de not yoksa Firebase'deki notlar silinmez.
      await pushNow(local, remoteNotesArr, remote.notesModified);
    }

  } catch(e) {
    console.warn('[sync]', e);
  }
}

// ─── Başlat ──────────────────────────────────────────────────────────────────

window.AppSync = { syncNow, pushNow };

syncNow();
window.addEventListener('online', syncNow);
