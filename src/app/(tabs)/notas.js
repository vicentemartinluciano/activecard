import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import ActionSheet from "../../components/ActionSheet";
import SectionSwipe from "../../components/SectionSwipe";
import Skeleton from "../../components/Skeleton";
import Toast from "../../components/Toast";
import { useSyncRefresh } from "../../components/useSyncRefresh";
import { Button, Chip, Field, Pill, Screen } from "../../components/ui";
import { listDecks, listTags } from "../../db/decks";
import { listFolders } from "../../db/folders";
import { createNote, listNotes, updateNote } from "../../db/notes";
import { databaseErrorMessage } from "../../lib/databaseError";
import { flattenFolders } from "../../lib/folderTree";
import { locationLabel } from "../../lib/libraryLocation";
import { colors, font, radius, spacing, type } from "../../theme";

function formatUpdated(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export default function Notas() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktopWorkspace = Platform.OS === "web" && width >= 760;

  const [notes, setNotes] = useState(null);
  const [folders, setFolders] = useState([]);
  const [decks, setDecks] = useState([]);
  const [tags, setTags] = useState([]);
  const [query, setQuery] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [folderId, setFolderId] = useState(null);
  const [deckId, setDeckId] = useState(null);
  const [tagId, setTagId] = useState(null);
  const [picker, setPicker] = useState(null); // "folder" | "deck" | null
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++request.current;
    try {
      const [loadedNotes, loadedFolders, loadedDecks, loadedTags] = await Promise.all([
        listNotes({ query, folderId, deckId, tagId, pinnedOnly }),
        listFolders(),
        listDecks(),
        listTags(),
      ]);
      if (ticket !== request.current) return;
      setNotes(loadedNotes);
      setFolders(loadedFolders);
      setDecks(loadedDecks);
      setTags(loadedTags);
      setError("");
    } catch (err) {
      if (ticket === request.current) {
        setError(databaseErrorMessage(err, "No pudimos cargar tus notas."));
      }
    }
  }, [query, folderId, deckId, tagId, pinnedOnly]);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        request.current++;
      };
    }, [load])
  );
  useSyncRefresh(load);

  const onCreateNote = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const id = await createNote({
        folderIds: folderId != null ? [folderId] : [],
        deckIds: deckId != null ? [deckId] : [],
        tagIds: tagId != null ? [tagId] : [],
      });
      router.push(`/notas/${id}`);
    } catch (err) {
      setError(databaseErrorMessage(err, "No pudimos crear la nota."));
    } finally {
      setCreating(false);
    }
  };

  const togglePin = async (note) => {
    try {
      await updateNote(note.id, { pinned: note.pinned ? 0 : 1 });
      await load();
    } catch (err) {
      setError(databaseErrorMessage(err, "No pudimos actualizar la nota."));
    }
  };

  const selectedFolder = folders.find((f) => f.id === folderId);
  const selectedDeck = decks.find((d) => d.id === deckId);
  const hasFilters = pinnedOnly || folderId != null || deckId != null || tagId != null || !!query.trim();
  const showFilterRow = folders.length > 0 || decks.length > 0 || tags.length > 0 || hasFilters;
  const clearFilters = () => {
    setQuery("");
    setPinnedOnly(false);
    setFolderId(null);
    setDeckId(null);
    setTagId(null);
  };

  if (desktopWorkspace) {
    return (
      <SectionSwipe index={2}>
        <Screen safeTop style={styles.desktopScreen}>
          {notes == null ? (
            <View style={styles.desktopStage}>
              <Skeleton height={36} style={{ width: 180 }} />
            </View>
          ) : (
            <View style={styles.desktopStage}>
              <Text style={styles.desktopStageTitle}>
                {notes.length ? "Elegí una nota" : "Escribí tu primera nota"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Nueva nota"
                disabled={creating}
                onPress={onCreateNote}
                style={({ hovered, pressed }) => [
                  styles.desktopCreateBtn,
                  hovered && { backgroundColor: "#D4D4D8" },
                  pressed && { opacity: 0.85 },
                  creating && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.desktopCreateBtnText}>{creating ? "Creando…" : "+ Crear nota"}</Text>
              </Pressable>
            </View>
          )}
          <Toast message={error} onRetry={load} />
        </Screen>
      </SectionSwipe>
    );
  }

  return (
    <SectionSwipe index={2}>
      <Screen safeTop style={Platform.OS === "web" ? styles.webScreen : undefined}>
        {notes == null ? (
          <View style={{ gap: spacing.sm }}>
            <Skeleton height={44} />
            <Skeleton height={64} />
            <Skeleton height={64} />
          </View>
        ) : (
          <FlatList
            data={notes}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={Platform.OS === "web"}
            ListHeaderComponent={
              <View style={styles.listHeader}>
                <View style={styles.header}>
                  <Text style={type.heading}>Notas</Text>
                  <Button
                    label={creating ? "Creando…" : "Nueva nota"}
                    kind="primary"
                    disabled={creating}
                    onPress={onCreateNote}
                  />
                </View>

                <View style={styles.searchWrap}>
                  <Field
                    accessibilityLabel="Buscar notas"
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Buscar…"
                    style={query ? { paddingRight: 40 } : undefined}
                  />
                  {!!query && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Limpiar búsqueda"
                      hitSlop={8}
                      onPress={() => setQuery("")}
                      style={styles.clearBtn}
                    >
                      <Feather name="x" size={16} color={colors.textMuted} />
                    </Pressable>
                  )}
                </View>

                {showFilterRow ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: spacing.xs, paddingRight: spacing.md }}
                  >
                    <Chip
                      label="Todas"
                      active={!pinnedOnly && folderId == null && deckId == null && tagId == null}
                      onPress={() => {
                        setPinnedOnly(false);
                        setFolderId(null);
                        setDeckId(null);
                        setTagId(null);
                      }}
                    />
                    <Chip
                      label="Fijadas"
                      active={pinnedOnly}
                      onPress={() => setPinnedOnly((v) => !v)}
                    />
                    {folders.length > 0 ? (
                      <Chip
                        label={selectedFolder ? `Carpeta: ${selectedFolder.name}` : "Carpeta ▾"}
                        active={folderId != null}
                        onPress={() => setPicker("folder")}
                      />
                    ) : null}
                    {decks.length > 0 ? (
                      <Chip
                        label={selectedDeck ? `Mazo: ${selectedDeck.name}` : "Mazo ▾"}
                        active={deckId != null}
                        onPress={() => setPicker("deck")}
                      />
                    ) : null}
                    {tags.map((t) => (
                      <Chip
                        key={t.id}
                        label={`#${t.name}`}
                        active={tagId === t.id}
                        onPress={() => setTagId((prev) => (prev === t.id ? null : t.id))}
                      />
                    ))}
                    {hasFilters ? (
                      <Button label="Limpiar" kind="ghost" size="sm" onPress={clearFilters} />
                    ) : null}
                  </ScrollView>
                ) : null}
              </View>
            }
            renderItem={({ item: note }) => {
              const titleText = note.title?.trim() || "Sin título";
              const dateText = formatUpdated(note.updated_at);
              const hasLinks = note.folders.length > 0 || note.decks.length > 0 || note.tags.length > 0;
              return (
                <View style={styles.noteRow}>
                  <View style={styles.rowTop}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir nota ${titleText}`}
                      onPress={() => router.push(`/notas/${note.id}`)}
                      style={({ pressed, hovered }) => [
                        styles.rowMainPress,
                        hovered && { opacity: 0.9 },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={styles.rowEmoji}>{note.icon || "📄"}</Text>
                      <View style={styles.rowBody}>
                        <Text style={styles.noteTitle} numberOfLines={1}>
                          {titleText}
                        </Text>
                        {note.excerpt ? (
                          <Text style={styles.noteExcerpt} numberOfLines={2}>
                            {note.excerpt}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                    <View style={styles.rowRight}>
                      {dateText ? <Text style={styles.rowDate}>{dateText}</Text> : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={note.pinned ? "Desfijar nota" : "Fijar nota"}
                        hitSlop={8}
                        onPress={() => togglePin(note)}
                        style={({ pressed }) => [styles.pinBtn, pressed && { opacity: 0.7 }]}
                      >
                        <Feather
                          name="bookmark"
                          size={15}
                          color={note.pinned ? colors.accentText : colors.textMuted}
                        />
                      </Pressable>
                      <Feather name="chevron-right" size={15} color={colors.textMuted} style={{ opacity: 0.5 }} />
                    </View>
                  </View>

                  {hasLinks ? (
                    <View style={styles.linksRow}>
                      {note.folders.map((folder) => (
                        <Pill
                          key={`f-${folder.id}`}
                          icon="folder"
                          label={folder.name}
                          color={colors.accentText}
                          style={styles.compactPill}
                          labelStyle={styles.compactPillLabel}
                          onPress={() => router.push(`/carpetas/${folder.id}`)}
                        />
                      ))}
                      {note.decks.map((deck) => (
                        <Pill
                          key={`d-${deck.id}`}
                          icon="layers"
                          label={deck.name}
                          color={colors.accentText}
                          style={styles.compactPill}
                          labelStyle={styles.compactPillLabel}
                          onPress={() => router.push(`/mazos/${deck.id}`)}
                        />
                      ))}
                      {note.tags.map((tag) => (
                        <Pill
                          key={`t-${tag.id}`}
                          label={`#${tag.name}`}
                          style={styles.compactPill}
                          labelStyle={styles.compactPillLabel}
                          onPress={() => setTagId((prev) => (prev === tag.id ? null : tag.id))}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>
                  {hasFilters ? "Nada coincide con tu búsqueda." : "Escribí tu primera nota"}
                </Text>
                {hasFilters ? (
                  <Button label="Ver todas las notas" onPress={clearFilters} />
                ) : (
                  <Button label={creating ? "Creando…" : "+ Crear nota"} kind="primary" onPress={onCreateNote} />
                )}
              </View>
            }
          />
        )}

        <ActionSheet
          visible={picker === "folder"}
          title="Filtrar por carpeta"
          onClose={() => setPicker(null)}
        >
          <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ gap: spacing.xs }}>
            <Button
              label="Todas las carpetas"
              kind={folderId == null ? "primary" : "default"}
              onPress={() => {
                setFolderId(null);
                setPicker(null);
              }}
            />
            {flattenFolders(folders).map((folder) => (
              <Pressable
                key={folder.id}
                onPress={() => {
                  setDeckId(null);
                  setFolderId(folder.id);
                  setPicker(null);
                }}
                style={({ pressed }) => [
                  styles.pickerRow,
                  { marginLeft: Math.min(folder.depth, 4) * 14 },
                  folderId === folder.id && styles.pickerRowActive,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text style={type.body}>{folder.name}</Text>
                {folder.parent_id != null ? (
                  <Text style={type.small}>{locationLabel(folders, folder.parent_id)}</Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </ActionSheet>

        <ActionSheet
          visible={picker === "deck"}
          title="Filtrar por mazo"
          onClose={() => setPicker(null)}
        >
          <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ gap: spacing.xs }}>
            <Button
              label="Todos los mazos"
              kind={deckId == null ? "primary" : "default"}
              onPress={() => {
                setDeckId(null);
                setPicker(null);
              }}
            />
            {decks.map((deck) => (
              <Pressable
                key={deck.id}
                onPress={() => {
                  setFolderId(null);
                  setDeckId(deck.id);
                  setPicker(null);
                }}
                style={({ pressed }) => [
                  styles.pickerRow,
                  deckId === deck.id && styles.pickerRowActive,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text style={type.body}>{deck.name}</Text>
                <Text style={type.small}>{locationLabel(folders, deck.folder_id)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </ActionSheet>

        <Toast message={error} onRetry={load} />
      </Screen>
    </SectionSwipe>
  );
}

const styles = StyleSheet.create({
  desktopScreen: {
    maxWidth: "100%",
    width: "100%",
    padding: 0,
  },
  desktopStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 20,
  },
  desktopStageTitle: {
    ...font(600),
    fontSize: 26,
    color: colors.text,
    textAlign: "center",
  },
  desktopCreateBtn: {
    backgroundColor: colors.text,
    paddingHorizontal: 22,
    paddingVertical: 12,
    minHeight: 46,
    justifyContent: "center",
    borderRadius: 8,
  },
  desktopCreateBtnText: {
    ...font(600),
    color: colors.bg,
    fontSize: 14.5,
  },
  webScreen: {
    maxWidth: 740,
  },
  listContent: {
    paddingBottom: spacing.xl * 2,
  },
  listHeader: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  searchWrap: {
    justifyContent: "center",
  },
  clearBtn: {
    position: "absolute",
    right: 10,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  noteRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rowMainPress: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowEmoji: {
    fontSize: 22,
    lineHeight: 28,
    width: 26,
    textAlign: "center",
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  noteTitle: {
    ...font(600),
    color: colors.text,
    fontSize: 16.5,
    lineHeight: 23,
  },
  noteExcerpt: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  pinBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  linksRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    paddingLeft: 38,
  },
  compactPill: {
    minHeight: 28,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  compactPillLabel: {
    fontSize: 12.5,
    ...font(500),
  },
  emptyWrap: {
    paddingVertical: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  emptyTitle: {
    ...font(600),
    fontSize: 17,
    color: colors.text,
    textAlign: "center",
  },
  pickerRow: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    gap: 2,
  },
  pickerRowActive: {
    backgroundColor: colors.surfaceHigh,
  },
});
