import Feather from "@expo/vector-icons/Feather";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { flattenFolders } from "../lib/folderTree";
import { locationLabel } from "../lib/libraryLocation";
import { normalizeSearch } from "../lib/search";
import { colors, font, radius, spacing, type } from "../theme";
import ActionSheet from "./ActionSheet";
import { Button, Chip, Field, InlineAdd } from "./ui";

function ToggleRow({ label, subtitle, checked, indent = 0, onPress, disabled }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        indent > 0 && { marginLeft: Math.min(indent, 4) * 14 },
        checked && styles.rowActive,
        pressed && { opacity: 0.75 },
      ]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxActive]}>
        {checked ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={type.body} numberOfLines={1}>{label}</Text>
        {subtitle ? <Text style={type.small} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function NoteAssociationsSheet({
  visible,
  onClose,
  folders = [],
  decks = [],
  allTags = [],
  selectedFolderIds = [],
  selectedDeckIds = [],
  selectedTagIds = [],
  onSaveFolders,
  onSaveDecks,
  onSaveTags,
  onCreateTag,
}) {
  const [tab, setTab] = useState("folders");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setQuery("");
    setError("");
  }, [visible]);

  const needle = normalizeSearch(query.trim());
  const treeFolders = flattenFolders(folders).filter(
    (folder) => !needle || normalizeSearch(`${folder.name} ${locationLabel(folders, folder.parent_id)}`).includes(needle)
  );
  const filteredDecks = decks.filter(
    (deck) => !needle || normalizeSearch(`${deck.name} ${locationLabel(folders, deck.folder_id)}`).includes(needle)
  );

  const toggle = async (currentIds, targetId, save) => {
    if (busy || !save) return;
    setBusy(true);
    setError("");
    try {
      const next = currentIds.includes(targetId)
        ? currentIds.filter((id) => id !== targetId)
        : [...currentIds, targetId];
      await save(next);
    } catch (e) {
      setError(e?.message || "No pudimos actualizar los vínculos.");
    } finally {
      setBusy(false);
    }
  };

  const addTag = async (name) => {
    if (busy || !onCreateTag) return;
    setBusy(true);
    setError("");
    try {
      await onCreateTag(name);
    } catch (e) {
      setError(e?.message || "No pudimos agregar la etiqueta.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ActionSheet visible={visible} title="Vincular nota" onClose={onClose}>
      <View style={styles.tabs}>
        <Chip
          label={`Carpetas (${selectedFolderIds.length})`}
          active={tab === "folders"}
          onPress={() => setTab("folders")}
        />
        <Chip
          label={`Mazos (${selectedDeckIds.length})`}
          active={tab === "decks"}
          onPress={() => setTab("decks")}
        />
        <Chip
          label={`Etiquetas (${selectedTagIds.length})`}
          active={tab === "tags"}
          onPress={() => setTab("tags")}
        />
      </View>

      {tab !== "tags" ? (
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder={tab === "folders" ? "Buscar carpeta…" : "Buscar mazo…"}
        />
      ) : null}

      <ScrollView style={{ maxHeight: 320, flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.xs }}>
        {tab === "folders" ? (
          <>
            <Text style={type.small}>
              Vincular una carpeta asocia automáticamente sus subcarpetas y todos los mazos adentro.
            </Text>
            {treeFolders.length ? treeFolders.map((folder) => (
              <ToggleRow
                key={folder.id}
                label={folder.name}
                subtitle={folder.parent_id != null ? locationLabel(folders, folder.parent_id) : "En raíz de Biblioteca"}
                indent={needle ? 0 : folder.depth}
                checked={selectedFolderIds.includes(folder.id)}
                disabled={busy}
                onPress={() => toggle(selectedFolderIds, folder.id, onSaveFolders)}
              />
            )) : <Text style={type.small}>No hay carpetas que coincidan.</Text>}
          </>
        ) : null}

        {tab === "decks" ? (
          filteredDecks.length ? filteredDecks.map((deck) => (
            <ToggleRow
              key={deck.id}
              label={deck.name}
              subtitle={locationLabel(folders, deck.folder_id)}
              checked={selectedDeckIds.includes(deck.id)}
              disabled={busy}
              onPress={() => toggle(selectedDeckIds, deck.id, onSaveDecks)}
            />
          )) : <Text style={type.small}>No hay mazos que coincidan.</Text>
        ) : null}

        {tab === "tags" ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={type.small}>
              Las etiquetas también vinculan la nota con los mazos que tengan la misma etiqueta.
            </Text>
            <View style={styles.tagsWrap}>
              {allTags.map((tag) => (
                <Chip
                  key={tag.id}
                  label={`#${tag.name}`}
                  active={selectedTagIds.includes(tag.id)}
                  onPress={() => toggle(selectedTagIds, tag.id, onSaveTags)}
                />
              ))}
              {allTags.length === 0 ? <Text style={type.small}>Todavía no hay etiquetas creadas.</Text> : null}
            </View>
            {onCreateTag ? <InlineAdd placeholder="Etiqueta nueva…" onSubmit={addTag} /> : null}
          </View>
        ) : null}
      </ScrollView>

      {!!error && <Text accessibilityRole="alert" style={[type.small, { color: colors.danger }]}>{error}</Text>}
      <Button label="Listo" kind="primary" onPress={onClose} />
    </ActionSheet>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowActive: {
    backgroundColor: colors.accentBg,
    borderColor: colors.accentMuted,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.pillBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  label: {
    ...font(600),
  },
});
