// BLUE HAVEN — account (Firebase Authentication, Google) + cloud save (Cloud Firestore).
// Free Spark plan only. The web config below is public by design; data is protected by Firestore security rules.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut as fbSignOut,
  deleteUser, reauthenticateWithPopup, connectAuthEmulator, signInWithCredential } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator, doc, getDoc, getDocFromCache, setDoc,
  serverTimestamp, collection, getDocs, writeBatch } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';

const CONFIG = {
  apiKey: 'AIzaSyBnnYSPMYyOyCtfArKBhuRgsLxmMNAe4_k',
  authDomain: 'bluehaven-motoraa.firebaseapp.com',
  projectId: 'bluehaven-motoraa',
  storageBucket: 'bluehaven-motoraa.firebasestorage.app',
  messagingSenderId: '421660476688',
  appId: '1:421660476688:web:1f1873a32f5cd04fdc1195',
};
const qs = new URLSearchParams(location.search);
export const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
// Test-only: local emulators + fake Google identity. Impossible in production (hostname check, emulator only accepts unsigned tokens).
export const EMU = LOCAL && qs.has('emu');
const app = initializeApp(CONFIG);
export const auth = getAuth(app);
export const db = initializeFirestore(app, EMU ? {} : { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
if (EMU) { connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectFirestoreEmulator(db, '127.0.0.1', 8085); }
const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });

// in-app browsers (messengers / social apps) block Google sign-in; we ask the player to open the page in a real browser
export const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Line\/|KAKAOTALK|NAVER\(inapp|; wv\)|Twitter|TikTok|Snapchat|MicroMessenger|DaumApps|everytimeApp/i.test(navigator.userAgent);

let authErrCb = null;
export function onUser(cb, errCb) {
  authErrCb = errCb;
  getRedirectResult(auth).catch((e) => errCb && errCb(e));
  return onAuthStateChanged(auth, cb);
}
export async function signIn() {
  if (EMU) {
    const who = qs.get('emu') || 'tester';
    const fake = JSON.stringify({ sub: 'emu-' + who, email: who + '@example.com', email_verified: true, name: 'Tester ' + who });
    return signInWithCredential(auth, GoogleAuthProvider.credential(fake));
  }
  try { return await signInWithPopup(auth, provider); }
  catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported', 'auth/cancelled-popup-request'].includes(e.code)) return signInWithRedirect(auth, provider);
    throw e;
  }
}

// ---------- save ----------
const V = 4;
let uid = null, existed = false, pending = null, timer = 0, writing = Promise.resolve();
const cacheKey = () => 'bluehaven.cloud.' + uid;
const int = (n, lo = 0, hi = 1e7) => Math.max(lo, Math.min(hi, Math.floor(Number(n) || 0)));
function pack(s) {
  const counts = {}; for (const [k, v] of Object.entries(s.counts || {})) counts[k] = int(v, 0, 1000);
  const decor = {}; for (const [k, v] of Object.entries(s.decor || {})) decor[k] = v && typeof v === 'object' ? v : int(v, 0, 1);
  const hs = {}; for (const [k, v] of Object.entries(s.hs || {})) hs[k] = int(v, 0, 1e9);
  const out = { v: V, pearls: int(s.pearls), counts, decor, hs, settings: s.settings || {}, daily: s.daily || {}, plays: int(s.plays, 0, 1e9) };
  for (const k of EXTRA) if (s[k] !== undefined) out[k] = s[k];
  return out;
}
// r5 fields are passed through untouched (validated by rules)
export const EXTRA = ['dex', 'bond', 'names', 'babies', 'quests', 'theme', 'sets', 'light', 'bgm', 'friends', 'isPublic', 'code', 'stats', 'nick'];

// returns { data, fresh, offline }
export async function loadSave(user) {
  uid = user.uid; const ref = doc(db, 'users', uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) { existed = true; const d = snap.data(); stash(d); return { data: d, fresh: false }; }
    existed = false; return { data: null, fresh: true };
  } catch (e) {
    try { const c = await getDocFromCache(ref); if (c.exists()) { existed = true; return { data: c.data(), fresh: false, offline: true }; } } catch (_) {}
    try { const c = JSON.parse(localStorage.getItem(cacheKey())); if (c) { existed = true; return { data: c, fresh: false, offline: true }; } } catch (_) {}
    existed = false; return { data: null, fresh: true, offline: true };
  }
}
function stash(d) { try { const c = Object.assign({}, d); delete c.updated; delete c.created; delete c.idleAt; localStorage.setItem(cacheKey(), JSON.stringify(c)); } catch (_) {} }
export function queueSave(s, now = false) {
  if (!uid) return; pending = s; stash(pack(s)); clearTimeout(timer);
  if (now) return flush(); timer = setTimeout(flush, 1200);
}
export function flush(extra) {
  if (!uid || !pending) return writing; const d = pack(pending); pending = null;
  d.updated = serverTimestamp(); if (!existed) d.created = serverTimestamp(); existed = true;
  if (extra) Object.assign(d, extra);
  const ref = doc(db, 'users', uid);
  writing = writing.then(() => setDoc(ref, d, { merge: true })).catch((e) => { console.warn('[cloud] save failed', e.code || e.message); });
  return writing;
}
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
addEventListener('pagehide', () => flush());

export async function signOut() { await flush(); uid = null; existed = false; return fbSignOut(auth); }

// permanently removes the save, the public snapshot (+ its hearts) and the sign-in itself
export async function deleteAccount() {
  const u = auth.currentUser; if (!u) return;
  const recent = Date.now() - Date.parse(u.metadata.lastSignInTime || 0) < 4 * 60 * 1000;
  if (!recent && !EMU) await reauthenticateWithPopup(u, provider);
  clearTimeout(timer); pending = null;
  const hearts = await getDocs(collection(db, 'public', u.uid, 'hearts')).catch(() => null);
  const refs = []; if (hearts) hearts.forEach((h) => refs.push(h.ref));
  for (let i = 0; i < refs.length; i += 400) { const b = writeBatch(db); refs.slice(i, i + 400).forEach((r) => b.delete(r)); await b.commit(); }
  const b = writeBatch(db); b.delete(doc(db, 'public', u.uid)); b.delete(doc(db, 'users', u.uid)); await b.commit();
  try { localStorage.removeItem('bluehaven.cloud.' + u.uid); } catch (_) {}
  uid = null; existed = false;
  await deleteUser(u);
}
export const fb = { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, writeBatch };
