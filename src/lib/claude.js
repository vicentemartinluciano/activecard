// Cliente único de la API de Claude (Anthropic). fetch directo, sin SDK.
// Sonnet 5 audita el Gimnasio Mental (criterio exigente); Haiku 4.5 genera
// tarjetas (extracción, ⅓ del costo, misma calidad para esa tarea).
// Un solo proveedor.

import { Platform } from "react-native";

import { getAnthropicKey } from "./keys";

export const MODELS = {
  sonnet: "claude-sonnet-5", // auditor Gimnasio Mental
  haiku: "claude-haiku-4-5", // generación de tarjetas
};
export const MODEL = MODELS.sonnet; // compat: default de callClaude
const API_URL = "https://api.anthropic.com/v1/messages";

export function getApiKey() {
  return getAnthropicKey();
}

// Llama a la API. messages: [{role, content}] donde content puede ser string
// o bloques (p. ej. documento PDF en base64). Devuelve el texto de la respuesta.
export async function callClaude({ system, messages, maxTokens = 4096, model = MODEL }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      Platform.OS === "web"
        ? "Falta la API key de Claude. Pegala en Ajustes (abajo del todo, sección de claves)."
        : "Falta la API key de Claude. Configurala en el archivo .env (EXPO_PUBLIC_ANTHROPIC_API_KEY) y reconstruí la app."
    );
  }

  let res;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        // Permite llamar directo desde el preview web (CORS). En Android no aplica.
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages,
      }),
    });
  } catch (e) {
    throw new Error("No se pudo conectar con Claude. ¿Hay internet?");
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body.error && body.error.message ? ` — ${body.error.message}` : "";
    } catch (e) {
      // sin cuerpo legible
    }
    if (res.status === 401) {
      throw new Error("La API key de Claude no es válida (401). Revisá el .env.");
    }
    if (res.status === 429) {
      throw new Error("Límite de uso de la API alcanzado (429). Esperá un momento.");
    }
    throw new Error(`Error de la API de Claude (${res.status})${detail}`);
  }

  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  return textBlock ? textBlock.text : "";
}

// Extrae el primer objeto JSON de una respuesta que puede venir con prosa
// alrededor o dentro de un bloque ```json```.
export function extractJson(text) {
  if (!text) throw new Error("Respuesta vacía de la IA.");
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  if (start === -1) throw new Error("La respuesta de la IA no contiene JSON.");
  // Recorrer balanceando llaves para encontrar el cierre del primer objeto,
  // ignorando llaves dentro de strings.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(candidate.slice(start, i + 1));
      }
    }
  }
  throw new Error("El JSON de la respuesta está incompleto.");
}

// Llama y parsea JSON, con un reintento pidiendo formato estricto si falla.
export async function callClaudeJson({ system, messages, maxTokens, model }) {
  const first = await callClaude({ system, messages, maxTokens, model });
  try {
    return extractJson(first);
  } catch (e) {
    const retry = await callClaude({
      system,
      messages: [
        ...messages,
        { role: "assistant", content: first },
        {
          role: "user",
          content:
            "Tu respuesta anterior no era JSON válido. Respondé ÚNICAMENTE con el objeto JSON pedido, sin ningún texto adicional.",
        },
      ],
      maxTokens,
      model,
    });
    return extractJson(retry);
  }
}
