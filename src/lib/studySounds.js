import { SOUND_KINDS } from "./studySoundScript";

const SETTING_KEY = "studySounds";

let enabledCache = true;
let activeBridge = null;
const subscribers = new Set();

function loadSettingsDb() {
  try {
    return require("../db/settings");
  } catch {
    return null;
  }
}

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

export function registerStudySoundBridge(dispatcher) {
  activeBridge = dispatcher;
  return () => {
    if (activeBridge === dispatcher) activeBridge = null;
  };
}

export function playStudySound(kind, { force = false } = {}) {
  if (!SOUND_KINDS.includes(kind)) return false;
  if (!force && !enabledCache) return false;
  if (typeof activeBridge !== "function") return false;
  try {
    activeBridge(kind);
    return true;
  } catch {
    return false;
  }
}

export function __resetStudySoundsForTest() {
  enabledCache = true;
  activeBridge = null;
}
