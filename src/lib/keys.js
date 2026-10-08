// Claves de API ingresadas en Ajustes y guardadas en settings de este dispositivo.
// Nunca leerlas de EXPO_PUBLIC_*: Expo incrusta esas variables en el cliente.
// No entran en los respaldos ni en la sincronización.
//
// getOpenAIKey()/getNotionToken() son síncronas (las usa el cliente de IA y
// notion.js dentro de un fetch, sin poder esperar una promesa) por eso se
// cachean en memoria: initKeys() se llama una sola vez al montar la app.

import { getSetting, setSetting } from "../db/settings";

let cache = { openai: null, notion: null };

export async function initKeys() {
  const [openai, notion] = await Promise.all([
    getSetting("openai_key", null),
    getSetting("notion_token", null),
  ]);
  cache = { openai, notion };
}

export function getOpenAIKey() {
  return cache.openai || null;
}

export function getNotionToken() {
  return cache.notion || null;
}

export async function setOpenAIKey(value) {
  const clean = value ? value.trim() : "";
  await setSetting("openai_key", clean || null);
  cache.openai = clean || null;
}

export async function setNotionToken(value) {
  const clean = value ? value.trim() : "";
  await setSetting("notion_token", clean || null);
  cache.notion = clean || null;
}
