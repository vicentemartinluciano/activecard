// Exportar/importar el respaldo como archivo real, en web y nativo.
// La lógica de armar/restaurar el JSON vive en src/lib/backup.js (pura,
// testeada); esto solo mueve bytes a/desde disco.

import * as DocumentPicker from "expo-document-picker";
import { Platform } from "react-native";

import { getDb } from "../db/client";
import { buildBackup, listSourcesFromMessages, normalizeBackup, restoreBackup } from "./backup";
import { applyAdditiveImport, prepareAdditiveImport } from "./backupMerge";

function fileName(now = new Date()) {
  const iso = now.toISOString().slice(0, 10);
  return `activecard-respaldo-${iso}.json`;
}

export async function listExportableSources() {
  const db = await getDb();
  const messages = await db.getAllAsync("SELECT id, chat_id, metadata FROM gym_messages");
  return listSourcesFromMessages(messages);
}

export async function exportBackup(now = new Date(), { sourceKeys } = {}) {
  const db = await getDb();
  const backup = await buildBackup(db, now, { sourceKeys });
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
  normalizeBackup(parsed);

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

function preImportFileName(now = new Date()) {
  return `activecard-antes-de-importar-${now.toISOString().replace(/[:.]/g, "-")}.json`;
}

export async function createPreImportBackup(now = new Date()) {
  const db = await getDb();
  const backup = await buildBackup(db, now);
  const json = JSON.stringify(backup, null, 2);
  const name = preImportFileName(now);
  if (Platform.OS === "web") {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return name;
  }
  const FileSystem = await import("expo-file-system/legacy");
  const uri = FileSystem.documentDirectory + name;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
  return uri;
}

export async function prepareParsedAdditiveImport(parsed) {
  const db = await getDb();
  return prepareAdditiveImport(db, parsed);
}

export async function mergeParsedBackup(parsed, selection, plan, now = new Date()) {
  const safetyCopy = await createPreImportBackup(now);
  const db = await getDb();
  const counts = await applyAdditiveImport(db, parsed, selection, plan);
  return { counts, safetyCopy };
}

const AUTO_BACKUP_KEY = "lastAutoBackup";
const AUTO_BACKUP_SLOT_KEY = "lastAutoBackupSlot";
const AUTO_BACKUP_FILES = [
  "activecard-auto-1.json",
  "activecard-auto-2.json",
  "activecard-auto-3.json",
];
const UNA_SEMANA = 7 * 24 * 60 * 60 * 1000;

export function nextAutoBackupSlot(lastSlot) {
  const slot = Number(lastSlot);
  return Number.isInteger(slot) && slot >= 1 && slot < AUTO_BACKUP_FILES.length ? slot + 1 : 1;
}

// Respaldo automático semanal, en silencio.
//
// NO reusa exportBackup a propósito: en nativo ese abre el diálogo de
// compartir, y un diálogo que aparece solo cada siete días sería insoportable.
// Acá el archivo se escribe en el directorio de la app y listo. Cubre el caso
// de borrar algo sin querer dentro de la app; para el respaldo que sobrevive al
// teléfono sigue estando el export manual, que es el que Martín se lleva.
//
// En web no hace nada: no se puede escribir a disco sin gatillar una descarga.
export async function autoBackupIfDue(now = new Date()) {
  if (Platform.OS === "web") return null;
  const { getSetting, setSetting } = await import("../db/settings");
  const last = await getSetting(AUTO_BACKUP_KEY, null);
  if (last && now.getTime() - new Date(last).getTime() < UNA_SEMANA) return null;

  const db = await getDb();
  const backup = await buildBackup(db, now);
  const FileSystem = await import("expo-file-system/legacy");
  const lastSlot = await getSetting(AUTO_BACKUP_SLOT_KEY, 0);
  const slot = nextAutoBackupSlot(lastSlot);
  const uri = FileSystem.documentDirectory + AUTO_BACKUP_FILES[slot - 1];
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(backup), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Promise.all([
    setSetting(AUTO_BACKUP_KEY, now.toISOString()),
    setSetting(AUTO_BACKUP_SLOT_KEY, slot),
  ]);
  return uri;
}
