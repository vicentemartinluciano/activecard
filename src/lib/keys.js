// Claves de API en runtime. En el APK llegan embebidas por env (EXPO_PUBLIC_*)
// al construir. En la web pública NO se embeben (el build de GitHub Pages
// corre sin .env) — ahí el usuario las pega una vez en Ajustes y quedan
// guardadas en la DB local del navegador (tabla settings).
//
// getAnthropicKey()/getNotionToken() son síncronas (las usan claude.js y
// notion.js dentro de un fetch, sin poder esperar una promesa) por eso se
// cachean en memoria: initKeys() se llama una sola vez al montar la app.

import { getSetting, setSetting } from "../db/settings";

let cache = { anthropic: null, notion: null };

export async function initKeys() {
  const [anthropic, notion] = await Promise.all([
    getSetting("anthropic_key", null),
    getSetting("notion_token", null),
  ]);
  cache = { anthropic, notion };
}

export function getAnthropicKey() {
  return cache.anthropic || process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || null;
}

export function getNotionToken() {
  return cache.notion || process.env.EXPO_PUBLIC_NOTION_TOKEN || null;
}

export async function setAnthropicKey(value) {
  const clean = value ? value.trim() : "";
  await setSetting("anthropic_key", clean || null);
  cache.anthropic = clean || null;
}

export async function setNotionToken(value) {
  const clean = value ? value.trim() : "";
  await setSetting("notion_token", clean || null);
  cache.notion = clean || null;
}
