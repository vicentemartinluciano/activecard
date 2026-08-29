// Selección y lectura de fuentes para Crear y Gimnasio Mental.
// En Android el picker muestra también Google Drive como proveedor,
// así que los documentos del Drive entran por acá (exportados a PDF/texto).

import * as DocumentPicker from "expo-document-picker";
import { Platform } from "react-native";

export function base64FromArrayBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function readUri(uri, { asBase64 }) {
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    if (asBase64) return base64FromArrayBuffer(await res.arrayBuffer());
    return res.text();
  }
  // Nativo: API legacy de expo-file-system (estable para leer strings).
  const FileSystem = await import("expo-file-system/legacy");
  return FileSystem.readAsStringAsync(uri, {
    encoding: asBase64 ? FileSystem.EncodingType.Base64 : FileSystem.EncodingType.UTF8,
  });
}

const GYM_FILE_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "image/*",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

const MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function fileMimeType(asset, name) {
  if (asset.mimeType && asset.mimeType !== "application/octet-stream") return asset.mimeType;
  const extension = name.split(".").pop()?.toLowerCase();
  return MIME_BY_EXTENSION[extension] || "application/octet-stream";
}

export async function pickGymFiles() {
  const result = await DocumentPicker.getDocumentAsync({
    type: GYM_FILE_TYPES,
    copyToCacheDirectory: true,
    multiple: true,
  });
  if (result.canceled || !result.assets?.length) return [];

  const files = [];
  for (const asset of result.assets.slice(0, 6)) {
    const name = asset.name || "documento";
    const mimeType = fileMimeType(asset, name);
    const isText = mimeType.startsWith("text/") || /\.(txt|md)$/i.test(name);
    if (isText) {
      const text = await readUri(asset.uri, { asBase64: false });
      if (text.trim()) files.push({ kind: "text", name, mimeType, text });
      continue;
    }
    const base64 = await readUri(asset.uri, { asBase64: true });
    if (base64.length > 24_000_000) {
      throw new Error(`"${name}" es demasiado grande (máximo aproximado: 18 MB).`);
    }
    files.push({ kind: "file", name, mimeType, base64 });
  }
  return files;
}

// Abre el picker y devuelve:
//   { kind: 'text', name, text }  para TXT/MD
//   { kind: 'pdf',  name, base64 } para PDF
//   null si el usuario canceló.
export async function pickStudyFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "text/plain", "text/markdown"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const name = asset.name || "documento";
  const isPdf =
    (asset.mimeType && asset.mimeType.includes("pdf")) || /\.pdf$/i.test(name);

  if (isPdf) {
    const base64 = await readUri(asset.uri, { asBase64: true });
    // Tope preventivo para no mandar documentos enormes desde el teléfono.
    if (base64.length > 24_000_000) {
      throw new Error("El PDF es demasiado grande (máximo ~18MB). Divídilo o exportá menos páginas.");
    }
    return { kind: "pdf", name, base64 };
  }

  const text = await readUri(asset.uri, { asBase64: false });
  if (!text.trim()) throw new Error("El archivo está vacío.");
  return { kind: "text", name, text };
}
