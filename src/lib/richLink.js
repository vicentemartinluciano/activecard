// Utilidades puras y contrato de enlaces estilo Notion (URL inline, mención,
// marcador y tarjeta). Sin dependencias nativas ni DOM: compartido por
// richtext.js, richhtml.js, editorPaste.js, tiptapLink.js y RichText.js.

export const LINK_BLOCK_SENTINEL = "\uE034";

const UNSAFE_URL_CHARS_RE = /[\u0000-\u001f\u007f\s<>"]/;
const SCHEME_PREFIX_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const AUTO_HOST_RE = /^[\w-]+(?:\.[\w-]+)+(?:[/:?#].*)?$/i;
const HTTP_PARTS_RE = /^(https?):\/\/([^/?#]+)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i;

function parseHttpUrlParts(raw) {
  const match = HTTP_PARTS_RE.exec(raw);
  if (!match) return null;
  const protocol = match[1].toLowerCase();
  const authority = match[2];
  const hostAndPort = authority.includes("@") ? authority.split("@").pop() : authority;
  if (!hostAndPort) return null;

  let hostname = hostAndPort;
  if (hostname.startsWith("[")) {
    const closeBracket = hostname.indexOf("]");
    if (closeBracket === -1) return null;
    hostname = hostname.slice(0, closeBracket + 1);
  } else {
    const colon = hostname.lastIndexOf(":");
    if (colon !== -1) {
      const port = hostname.slice(colon + 1);
      if (!/^\d{1,5}$/.test(port)) return null;
      hostname = hostname.slice(0, colon);
    }
  }
  const lowerHost = hostname.toLowerCase();
  if (!lowerHost || lowerHost.startsWith(".") || lowerHost.endsWith(".") || lowerHost.includes("..")) return null;
  if (!lowerHost.startsWith("[") && !/^[a-z0-9.-]+$/i.test(lowerHost)) return null;
  if (lowerHost !== "localhost" && !lowerHost.startsWith("[") && !lowerHost.includes(".")) return null;

  return {
    protocol,
    hostname: lowerHost,
    pathname: match[3] || "/",
    search: match[4] || "",
  };
}

export function sanitizeLinkUrl(raw, { autoScheme = false } = {}) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed || UNSAFE_URL_CHARS_RE.test(trimmed)) return null;

  const hasScheme = SCHEME_PREFIX_RE.test(trimmed);
  if (hasScheme && !/^https?:\/\//i.test(trimmed)) return null;

  const candidate = hasScheme ? trimmed : autoScheme && AUTO_HOST_RE.test(trimmed) ? `https://${trimmed}` : "";
  if (!candidate) return null;

  return parseHttpUrlParts(candidate) ? candidate : null;
}

export function openExternalLink(url, sourceEl = null) {
  const safeUrl = sanitizeLinkUrl(url, { autoScheme: true });
  if (!safeUrl || typeof window === "undefined") return false;
  if (window.ReactNativeWebView) {
    const doc = typeof document !== "undefined" ? document : null;
    const host = sourceEl?.closest?.(".nf-root") || doc?.querySelector?.(".nf-root") || null;
    if (!host) return false;
    host.dispatchEvent(new CustomEvent("nf:open-url", { bubbles: true, detail: { url: safeUrl } }));
    return true;
  }
  window.open?.(safeUrl, "_blank", "noopener,noreferrer");
  return true;
}

export function isStandaloneUrl(text) {
  if (text == null) return false;
  const trimmed = String(text).trim();
  if (!trimmed || /[\r\n\s]/.test(trimmed)) return false;
  if (!/^https?:\/\//i.test(trimmed)) return false;
  return Boolean(sanitizeLinkUrl(trimmed));
}

export function linkDomain(url) {
  const safe = sanitizeLinkUrl(url, { autoScheme: true });
  if (!safe) return "";
  const parts = parseHttpUrlParts(safe);
  return parts ? parts.hostname.replace(/^www\./i, "") : "";
}

export function linkDisplayTitle(url, fallback = "") {
  const fb = fallback == null ? "" : String(fallback).trim();
  if (fb) return fb;
  const safe = sanitizeLinkUrl(url, { autoScheme: true });
  if (!safe) return "Enlace";
  const parts = parseHttpUrlParts(safe);
  if (!parts) return "Enlace";
  const domain = parts.hostname.replace(/^www\./i, "");
  const segments = parts.pathname.split("/").filter(Boolean);
  const rawLast = segments.length ? segments[segments.length - 1] : "";
  let decoded = rawLast;
  try {
    decoded = decodeURIComponent(rawLast);
  } catch {
    decoded = rawLast;
  }
  const cleanTail = decoded
    .replace(/\.(html?|php|aspx?)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (cleanTail && !["watch", "index", "home"].includes(cleanTail.toLowerCase()) && cleanTail.length <= 42) {
    const combined = `${domain} · ${cleanTail}`;
    return combined.length <= 64 ? combined : combined.slice(0, 61) + "…";
  }
  return domain || "Enlace";
}

export function linkPlatformInfo(url) {
  const safe = sanitizeLinkUrl(url, { autoScheme: true });
  const domain = linkDomain(url).toLowerCase();
  const pathname = (safe && parseHttpUrlParts(safe)?.pathname.toLowerCase()) || "";

  if (domain === "youtu.be" || domain.endsWith("youtube.com")) {
    return { id: "youtube", name: "YouTube", icon: "▶", accent: "#E5484D" };
  }
  if (domain === "github.com" || domain.endsWith(".github.com")) {
    return { id: "github", name: "GitHub", icon: "⌘", accent: "#9BB4FF" };
  }
  if (domain === "docs.google.com") {
    if (pathname.startsWith("/spreadsheets")) {
      return { id: "gsheets", name: "Google Sheets", icon: "▦", accent: "#46A758" };
    }
    if (pathname.startsWith("/presentation")) {
      return { id: "gslides", name: "Google Slides", icon: "◫", accent: "#FFC53D" };
    }
    if (pathname.startsWith("/document")) {
      return { id: "gdocs", name: "Google Docs", icon: "▤", accent: "#6E8BEB" };
    }
    return { id: "gdrive", name: "Google Drive", icon: "△", accent: "#9BB4FF" };
  }
  if (domain === "drive.google.com") {
    return { id: "gdrive", name: "Google Drive", icon: "△", accent: "#9BB4FF" };
  }
  if (domain === "notion.so" || domain.endsWith(".notion.so") || domain.endsWith("notion.site")) {
    return { id: "notion", name: "Notion", icon: "N", accent: "#F3F4F8" };
  }
  if (domain === "figma.com" || domain.endsWith(".figma.com")) {
    return { id: "figma", name: "Figma", icon: "◈", accent: "#9E6EDE" };
  }
  if (domain.endsWith("wikipedia.org")) {
    return { id: "wikipedia", name: "Wikipedia", icon: "W", accent: "#F3F4F8" };
  }
  if (domain === "x.com" || domain === "twitter.com") {
    return { id: "x", name: "X", icon: "𝕏", accent: "#F3F4F8" };
  }
  return { id: "web", name: domain || "Web", icon: "↗", accent: "#9BB4FF" };
}

export function matchMarkdownLinkAt(line, start) {
  if (!line || start < 0 || start >= line.length) return null;
  if (line[start] !== "[" || line[start + 1] === "[") return null;

  let bracketDepth = 1;
  let closeBracket = -1;
  for (let i = start + 1; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "\n") return null;
    if (ch === "[") {
      bracketDepth += 1;
    } else if (ch === "]") {
      bracketDepth -= 1;
      if (bracketDepth === 0) {
        closeBracket = i;
        break;
      }
    }
  }
  if (closeBracket === -1 || line[closeBracket + 1] !== "(") return null;

  const label = line.slice(start + 1, closeBracket);
  if (!label) return null;

  const urlStart = closeBracket + 2;
  let parenDepth = 1;
  let closeParen = -1;
  for (let j = urlStart; j < line.length; j += 1) {
    const ch = line[j];
    if (ch === "\n") return null;
    if (ch === "(") {
      parenDepth += 1;
    } else if (ch === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        closeParen = j;
        break;
      }
    }
  }
  if (closeParen === -1) return null;

  const inside = line.slice(urlStart, closeParen).trim();
  const mentionMatch = /^(\S+)\s+"mention"$/.exec(inside);
  const rawUrl = mentionMatch ? mentionMatch[1] : inside;
  const display = mentionMatch ? "mention" : "inline";
  const href = sanitizeLinkUrl(rawUrl);
  if (!href) return null;

  return { label, href, display, end: closeParen + 1 };
}

export function encodeLinkBlock(link) {
  const safeUrl = sanitizeLinkUrl(link?.url, { autoScheme: true }) || String(link?.url || "").trim();
  const payload = {
    v: 1,
    url: safeUrl,
    title: String(link?.title || ""),
    description: String(link?.description || ""),
    variant: link?.variant === "card" ? "card" : "bookmark",
  };
  return LINK_BLOCK_SENTINEL + encodeURIComponent(JSON.stringify(payload));
}

export function decodeLinkBlock(line) {
  if (!line || !line.startsWith(LINK_BLOCK_SENTINEL)) return null;
  try {
    const value = JSON.parse(decodeURIComponent(line.slice(1)));
    const url = sanitizeLinkUrl(value?.url);
    if (!value || value.v !== 1 || !url || typeof value.title !== "string") return null;
    return {
      url,
      title: value.title,
      description: typeof value.description === "string" ? value.description : "",
      variant: value.variant === "card" ? "card" : "bookmark",
    };
  } catch {
    return null;
  }
}
