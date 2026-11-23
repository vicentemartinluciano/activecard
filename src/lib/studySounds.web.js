import { playSynthSound, SOUND_KINDS } from "./studySoundScript";

const SETTING_KEY = "studySounds";

let enabledCache = true;
let liveCtx = null;
let listenersBound = false;
const subscribers = new Set();

function loadSettingsDb() {
  try {
    return require("../db/settings");
  } catch {
    return null;
  }
}

function getContext() {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (typeof AudioCtx !== "function") return null;
  if (!liveCtx) {
    try {
      liveCtx = new AudioCtx({ latencyHint: "interactive" });
    } catch {
      return null;
    }
  }
  return liveCtx;
}

function unlockContext() {
  const ctx = getContext();
  if (!ctx || ctx.state === "running") return;
  try {
    Promise.resolve(ctx.resume()).catch(() => {});
  } catch {}
}

function bindUnlockOnce() {
  if (listenersBound || typeof document === "undefined") return;
  listenersBound = true;
  document.addEventListener("pointerdown", unlockContext, { capture: true, passive: true });
  document.addEventListener("keydown", unlockContext, { capture: true, passive: true });
}

bindUnlockOnce();

export function isStudySoundsEnabled() {
  return enabledCache;
}

export async function loadStudySoundsEnabled() {
  try {
    const db = loadSettingsDb();
    if (typeof db?.getSetting === "function") {
      const stored = await db.getSetting(SETTING_KEY, true);
      enabledCache = stored !== false;
    } else {
      enabledCache = true;
    }
  } catch {
    enabledCache = true;
  }
  subscribers.forEach((fn) => fn(enabledCache));
  return enabledCache;
}

export async function setStudySoundsEnabled(enabled) {
  enabledCache = Boolean(enabled);
  subscribers.forEach((fn) => fn(enabledCache));
  const db = loadSettingsDb();
  if (typeof db?.setSetting === "function") {
    await db.setSetting(SETTING_KEY, enabledCache);
  }
  return enabledCache;
}

export function subscribeStudySoundsEnabled(listener) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

export function playStudySound(kind, { force = false } = {}) {
  if (!SOUND_KINDS.includes(kind)) return false;
  if (!force && !enabledCache) return false;
  if (typeof document !== "undefined" && document.hidden) return false;
  const ctx = getContext();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended" && typeof ctx.resume === "function") {
      Promise.resolve(ctx.resume())
        .then(() => {
          playSynthSound(ctx, kind);
        })
        .catch(() => {});
      return true;
    }
    return playSynthSound(ctx, kind);
  } catch {
    return false;
  }
}

export function registerStudySoundBridge() {
  return () => {};
}

export function __resetStudySoundsForTest() {
  enabledCache = true;
  liveCtx = null;
}
