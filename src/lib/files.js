// Selección y lectura de archivos (TXT/MD locales, PDF a base64).
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
    // Límite de la API de Claude: ~32MB por request (el base64 pesa ~33% más).
    if (base64.length > 24_000_000) {
      throw new Error("El PDF es demasiado grande (máximo ~18MB). Divídilo o exportá menos páginas.");
    }
    return { kind: "pdf", name, base64 };
  }

  const text = await readUri(asset.uri, { asBase64: false });
  if (!text.trim()) throw new Error("El archivo está vacío.");
  return { kind: "text", name, text };
}
