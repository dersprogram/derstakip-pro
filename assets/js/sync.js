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
  _ops = { ref: dbMod.ref, get: dbMod.get, set: dbMod.set, update: dbMod.update };
}

// ─── Uid yardımcısı ──────────────────────────────────────────────────────────

function getUid() {
  const data = window.AppShell?.loadAppData?.();
  if (!data) return null;
  if (window.AppShell?.isGuestUser?.(data)) return null;
  return data.settings?.firebaseUid || null;
}

// ─── Firebase'e yaz ──────────────────────────────────────────────────────────
// Ana veri her zaman set() ile yazılır.
// Notlar: local'de not varsa set() (tam yaz), yoksa update() (notes alanına dokunma).

export async function pushNow(appData) {
  if (!navigator.onLine) return;
  const data = appData || window.AppShell?.loadAppData?.();
  if (!data) return;
  const uid = data.settings?.firebaseUid || getUid();
  if (!uid) return;

  try {
    await ensureDb();
    const { ref, set, update } = _ops;

    const rawNotes = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
    let notesTs    = Number(localStorage.getItem(NOTES_TS_KEY) || 0);
    if (notesTs === 0 && rawNotes.length > 0) {
      notesTs = Date.now();
      localStorage.setItem(NOTES_TS_KEY, String(notesTs));
    }

    const mainPayload = {
      lessons:      data.lessons      || [],
      weeklyGrid:   data.weeklyGrid   || {},
      activeDays:   data.activeDays   || [0, 1, 2, 3, 4],
      lastModified: data.lastModified || Date.now(),
    };
    if (data.plans) mainPayload.plans = data.plans;

    if (rawNotes.length > 0) {
      // Local'de not var → set() ile tam yaz (notlar dahil)
      mainPayload.notes         = rawNotes;
      mainPayload.notesModified = notesTs;
      await set(ref(_db, 'users/' + uid), mainPayload);
    } else {
      // Local'de not yok → update() ile sadece ana alanları güncelle, Firebase notlarına dokunma
      await update(ref(_db, 'users/' + uid), mainPayload);
    }
  } catch(e) {
    console.warn('[sync] push hatası:', e);
  }
}

// ─── Notları Firebase'e yaz ───────────────────────────────────────────────────

async function pushNotesNow(uid) {
  const rawNotes = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
  if (!rawNotes.length) return;
  let notesTs = Number(localStorage.getItem(NOTES_TS_KEY) || 0);
  if (!notesTs) {
    notesTs = Date.now();
    localStorage.setItem(NOTES_TS_KEY, String(notesTs));
  }
  await ensureDb();
  const { ref, update } = _ops;
  await update(ref(_db, 'users/' + uid), {
    notes:         rawNotes,
    notesModified: notesTs,
  });
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
      const withTs = Object.assign({}, local, {
        lastModified: local.lastModified || Date.now(),
      });
      await pushNow(withTs);
      return;
    }

    // ── Ana veri ──────────────────────────────────────────────────────────
    const localTs       = local.lastModified  || 0;
    const remoteTs      = remote.lastModified || 0;
    const localEmpty    = !Array.isArray(local.lessons) || local.lessons.length === 0;
    const remoteHasData = Array.isArray(remote.lessons) && remote.lessons.length > 0;

    if (remoteTs > localTs || (localEmpty && remoteHasData)) {
      // Firebase daha yeni → local'i güncelle
      local.lessons      = remote.lessons    ?? local.lessons;
      local.weeklyGrid   = remote.weeklyGrid ?? local.weeklyGrid;
      local.activeDays   = remote.activeDays ?? local.activeDays;
      if (remote.plans)  local.plans = remote.plans;
      local.lastModified = remoteTs;
      localStorage.setItem(window.AppShell.SETTINGS_KEY, JSON.stringify(local));
      window.dispatchEvent(new CustomEvent('appDataSynced', {
        detail: { source: 'firebase', lessons: local.lessons, weeklyGrid: local.weeklyGrid }
      }));
      // Local'de not varsa Firebase'e gönder (pull senaryosunda notlar gitmez)
      const localNotes = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
      if (localNotes.length > 0) {
        await pushNotesNow(uid);
      }
    } else {
      // Local daha yeni ya da aynı → Firebase'e gönder
      // pushNow: notlu cihazda set(), notsuz cihazda update() — Firebase notlarını silmez
      await pushNow(local);
    }

    // ── Notlar ───────────────────────────────────────────────────────────
    const localNotesTs  = Number(localStorage.getItem(NOTES_TS_KEY) || 0);
    const remoteNotesTs = remote.notesModified || 0;
    if (remoteNotesTs > localNotesTs && Array.isArray(remote.notes) && remote.notes.length > 0) {
      localStorage.setItem(NOTES_KEY, JSON.stringify(remote.notes));
      localStorage.setItem(NOTES_TS_KEY, String(remoteNotesTs));
      window.dispatchEvent(new CustomEvent('appDataSynced', {
        detail: { source: 'firebase', notes: remote.notes }
      }));
    }

  } catch(e) {
    console.warn('[sync]', e);
  }
}

// ─── Başlat ──────────────────────────────────────────────────────────────────

window.AppSync = { syncNow, pushNow };

syncNow();
window.addEventListener('online', syncNow);
