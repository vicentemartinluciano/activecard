// Cliente de IA de ActiveCard. Usa Responses API con GPT-5.6 Luna.
// En el APK puede llamar a un gateway propio (recomendado) o, durante el
// desarrollo, usar una clave directa. La web pública usa la clave guardada
// localmente por el usuario en ese navegador.

import { Platform } from "react-native";

import { getOpenAIKey } from "./keys";

export const MODELS = { luna: "gpt-5.6-luna" };
export const REASONING = { chat: "high", complex: "xhigh" };
export const MODEL = MODELS.luna;

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const gatewayUrl = () => (process.env.EXPO_PUBLIC_ACTIVECARD_AI_URL || "").trim();
const gatewayToken = () => (process.env.EXPO_PUBLIC_ACTIVECARD_AI_TOKEN || "").trim();

export function getApiKey() {
  return getOpenAIKey();
}

function outputText(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  for (const item of data?.output || []) {
    if (item?.type !== "message") continue;
    const block = (item.content || []).find((content) => content?.type === "output_text");
    if (typeof block?.text === "string") return block.text;
  }
  return "";
}

function requestTarget() {
  const gateway = Platform.OS === "web" ? "" : gatewayUrl();
  if (gateway) {
    return {
      url: gateway,
      headers: gatewayToken() ? { "x-activecard-token": gatewayToken() } : {},
    };
  }
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      Platform.OS === "web"
        ? "Falta la API key de OpenAI. Pegala en Ajustes; queda guardada solo en este navegador."
        : "Falta configurar la conexión de OpenAI para ActiveCard."
    );
  }
  return { url: RESPONSES_URL, headers: { Authorization: `Bearer ${apiKey}` } };
}

export async function callOpenAI({
  system,
  messages,
  maxTokens = 10000,
  model = MODEL,
  reasoningEffort = REASONING.chat,
  json = false,
}) {
  const target = requestTarget();
  let response;
  try {
    response = await fetch(target.url, {
      method: "POST",
      headers: { "content-type": "application/json", ...target.headers },
      body: JSON.stringify({
        model,
        instructions: system,
        input: messages,
        max_output_tokens: maxTokens,
        reasoning: { effort: reasoningEffort },
        text: {
          verbosity: "medium",
          format: json ? { type: "json_object" } : { type: "text" },
        },
        store: false,
        safety_identifier: "activecard-private",
      }),
    });
  } catch {
    throw new Error("No se pudo conectar con OpenAI. Revisá la conexión a internet.");
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body.error?.message ? ` — ${body.error.message}` : "";
    } catch {
      // El gateway o la API pueden devolver un cuerpo no JSON.
    }
    if (response.status === 401) throw new Error("La conexión de OpenAI no es válida (401).");
    if (response.status === 429) throw new Error("Se alcanzó el límite de uso de OpenAI (429). Esperá un momento.");
    throw new Error(`Error de OpenAI (${response.status})${detail}`);
  }

  const data = await response.json();
  if (data.status === "incomplete") {
    throw new Error("OpenAI no pudo completar la respuesta. Probá nuevamente con menos material.");
  }
  const text = outputText(data);
  if (!text) throw new Error("OpenAI devolvió una respuesta vacía.");
  return text;
}

export function extractJson(text) {
  if (!text) throw new Error("Respuesta vacía de la IA.");
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  if (start === -1) throw new Error("La respuesta de la IA no contiene JSON.");
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
      if (depth === 0) return JSON.parse(candidate.slice(start, i + 1));
    }
  }
  throw new Error("El JSON de la respuesta está incompleto.");
}

export async function callOpenAIJson(options) {
  const first = await callOpenAI({ ...options, json: true });
  try {
    return extractJson(first);
  } catch {
    const retry = await callOpenAI({
      ...options,
      json: true,
      messages: [
        ...options.messages,
        { role: "assistant", content: first },
        { role: "user", content: "Respondé únicamente con el objeto JSON solicitado." },
      ],
    });
    return extractJson(retry);
  }
}
