// Exportar/importar el respaldo como archivo real, en web y nativo.
// La lógica de armar/restaurar el JSON vive en src/lib/backup.js (pura,
// testeada); esto solo mueve bytes a/desde disco.

import * as DocumentPicker from "expo-document-picker";
import { Platform } from "react-native";

import { getDb } from "../db/client";
import { buildBackup, restoreBackup } from "./backup";

function fileName(now = new Date()) {
  const iso = now.toISOString().slice(0, 10);
  return `activecard-respaldo-${iso}.json`;
}

export async function exportBackup(now = new Date()) {
  const db = await getDb();
  const backup = await buildBackup(db, now);
  const json = JSON.stringify(backup, null, 2);
  const name = fileName(now);

  if (Platform.OS === "web") {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return name;
  }

  const FileSystem = await import("expo-file-system/legacy");
  const Sharing = await import("expo-sharing");
  const uri = FileSystem.cacheDirectory + name;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: name });
  }
  return name;
}

// Abre el picker una sola vez y devuelve el JSON ya parseado + un resumen
// para mostrar antes de confirmar el reemplazo. null si el usuario canceló.
export async function pickBackupFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets || result.assets.length === 0) return null;

  const uri = result.assets[0].uri;
  let text;
  if (Platform.OS === "web") {
    text = await (await fetch(uri)).text();
  } else {
    const FileSystem = await import("expo-file-system/legacy");
    text = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error("El archivo no es un JSON válido.");
  }

  return {
    parsed,
    decks: Array.isArray(parsed.decks) ? parsed.decks.length : 0,
    cards: Array.isArray(parsed.cards) ? parsed.cards.length : 0,
  };
}

export async function restoreParsedBackup(parsed) {
  const db = await getDb();
  return restoreBackup(db, parsed);
}
