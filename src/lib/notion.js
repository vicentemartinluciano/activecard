// Lector de páginas de Notion vía internal integration token (sin OAuth).
// La página debe estar compartida con la integración (menú ··· → Connections).

import { getNotionToken as getNotionTokenFromKeys } from "./keys";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export function getNotionToken() {
  return getNotionTokenFromKeys();
}

// Acepta una URL de Notion o un ID pelado y devuelve el ID normalizado.
export function parsePageId(input) {
  const clean = (input || "").trim();
  // ID con o sin guiones (32 hex) al final de la URL o suelto.
  const m = clean.replace(/-/g, "").match(/([0-9a-f]{32})(?:[?#].*)?$/i);
  if (!m) {
    throw new Error(
      "No se reconoce la página. Pegá el enlace completo de la página de Notion (Compartir → Copiar enlace)."
    );
  }
  const id = m[1];
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

async function notionFetch(path) {
  const token = getNotionToken();
  if (!token) {
    throw new Error(
      "Falta el token de Notion. Configuralo en el archivo .env (EXPO_PUBLIC_NOTION_TOKEN)."
    );
  }
  let res;
  try {
    res = await fetch(`${NOTION_API}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
      },
    });
  } catch (e) {
    throw new Error("No se pudo conectar con Notion. ¿Hay internet?");
  }
  if (res.status === 404) {
    throw new Error(
      "Notion no encuentra la página. Asegurate de compartirla con la integración: en la página, menú ··· → Connections → elegí tu integración."
    );
  }
  if (res.status === 401) {
    throw new Error("El token de Notion no es válido (401). Revisá el .env.");
  }
  if (!res.ok) {
    throw new Error(`Error de la API de Notion (${res.status}).`);
  }
  return res.json();
}

function richText(block) {
  const rt = block[block.type] && block[block.type].rich_text;
  if (!rt) return "";
  return rt.map((t) => t.plain_text).join("");
}

// Convierte una lista de bloques de Notion (con children ya anidados en
// block.__children) a texto plano legible para la IA.
export function blocksToText(blocks, depth = 0) {
  const indent = "  ".repeat(depth);
  const lines = [];
  for (const b of blocks) {
    const text = richText(b);
    switch (b.type) {
      case "heading_1":
        lines.push(`\n# ${text}`);
        break;
      case "heading_2":
        lines.push(`\n## ${text}`);
        break;
      case "heading_3":
        lines.push(`\n### ${text}`);
        break;
      case "bulleted_list_item":
      case "to_do":
        lines.push(`${indent}- ${text}`);
        break;
      case "numbered_list_item":
        lines.push(`${indent}1. ${text}`);
        break;
      case "toggle":
      case "paragraph":
      case "quote":
      case "callout":
        if (text) lines.push(`${indent}${text}`);
        break;
      case "code":
        if (text) lines.push(`${indent}${text}`);
        break;
      case "table_row": {
        const cells = (b.table_row && b.table_row.cells) || [];
        lines.push(
          `${indent}| ${cells.map((c) => c.map((t) => t.plain_text).join("")).join(" | ")} |`
        );
        break;
      }
      case "divider":
        lines.push("---");
        break;
      default:
        if (text) lines.push(`${indent}${text}`);
    }
    if (b.__children && b.__children.length > 0) {
      lines.push(blocksToText(b.__children, depth + 1));
    }
  }
  return lines.join("\n");
}

// Baja recursivamente todos los bloques de un bloque/página (con paginación).
async function fetchBlockChildren(blockId) {
  const blocks = [];
  let cursor = null;
  do {
    const qs = cursor ? `?page_size=100&start_cursor=${cursor}` : "?page_size=100";
    const data = await notionFetch(`/blocks/${blockId}/children${qs}`);
    blocks.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  for (const b of blocks) {
    if (b.has_children) {
      b.__children = await fetchBlockChildren(b.id);
    }
  }
  return blocks;
}

// Devuelve { title, text } de una página de Notion a partir de URL o ID.
export async function fetchNotionPage(urlOrId) {
  const pageId = parsePageId(urlOrId);
  const page = await notionFetch(`/pages/${pageId}`);

  let title = "Página de Notion";
  const props = page.properties || {};
  for (const key of Object.keys(props)) {
    if (props[key].type === "title" && props[key].title.length > 0) {
      title = props[key].title.map((t) => t.plain_text).join("");
      break;
    }
  }

  const blocks = await fetchBlockChildren(pageId);
  const text = blocksToText(blocks).trim();
  if (!text) {
    throw new Error("La página de Notion está vacía o no tiene texto legible.");
  }
  return { title, text };
}
