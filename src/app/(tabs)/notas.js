import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import ActionSheet from "../../components/ActionSheet";
import SectionSwipe from "../../components/SectionSwipe";
import Skeleton from "../../components/Skeleton";
import Toast from "../../components/Toast";
import { useSyncRefresh } from "../../components/useSyncRefresh";
import { Button, Card, Chip, EmptyState, Field, Pill, Screen } from "../../components/ui";
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
  const clearFilters = () => {
    setQuery("");
    setPinnedOnly(false);
    setFolderId(null);
    setDeckId(null);
    setTagId(null);
  };

  return (
    <SectionSwipe index={2}>
      <Screen safeTop>
        {notes == null ? (
          <View style={{ gap: spacing.sm }}>
            <Skeleton height={56} />
            <Skeleton height={110} />
            <Skeleton height={110} />
          </View>
        ) : (
          <FlatList
            data={notes}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
            showsVerticalScrollIndicator={Platform.OS === "web"}
            ListHeaderComponent={
              <View style={{ gap: spacing.md, paddingBottom: spacing.xs }}>
                <View style={styles.header}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={type.heading}>Notas</Text>
                    <Text style={type.small}>
                      {notes.length} {notes.length === 1 ? "nota" : "notas"} · mapa previo y material de respaldo
                    </Text>
                  </View>
                  <Button
                    label={creating ? "Creando…" : "Nueva nota"}
                    kind="primary"
                    disabled={creating}
                    onPress={onCreateNote}
                  />
                </View>

                <View style={{ justifyContent: "center" }}>
                  <Field
                    accessibilityLabel="Buscar notas"
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Buscar por título, contenido, mazo o carpeta…"
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
                      <Feather name="x" size={17} color={colors.textMuted} />
                    </Pressable>
                  )}
                </View>

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
                  <Chip
                    label={selectedFolder ? `Carpeta: ${selectedFolder.name}` : "Carpeta ▾"}
                    active={folderId != null}
                    onPress={() => setPicker("folder")}
                  />
                  <Chip
                    label={selectedDeck ? `Mazo: ${selectedDeck.name}` : "Mazo ▾"}
                    active={deckId != null}
                    onPress={() => setPicker("deck")}
                  />
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
              </View>
            }
            renderItem={({ item: note }) => {
              const titleText = note.title?.trim() || "Nota sin título";
              const dateText = formatUpdated(note.updated_at);
              const hasLinks = note.folders.length > 0 || note.decks.length > 0 || note.tags.length > 0;
              return (
                <Card style={styles.noteCard}>
                  <View style={styles.cardTopRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir nota ${titleText}`}
                      onPress={() => router.push(`/notas/${note.id}`)}
                      style={({ pressed }) => [styles.cardMainPress, pressed && { opacity: 0.78 }]}
                    >
                      <View style={styles.titleRow}>
                        <Feather
                          name={note.pinned ? "bookmark" : "file-text"}
                          size={17}
                          color={note.pinned ? colors.accentText : colors.textMuted}
                        />
                        <Text style={styles.noteTitle} numberOfLines={1}>
                          {titleText}
                        </Text>
                        {dateText ? <Text style={type.small}>{dateText}</Text> : null}
                      </View>
                      <Text
                        style={[type.small, !note.excerpt && { fontStyle: "italic" }]}
                        numberOfLines={3}
                      >
                        {note.excerpt || "Nota vacía — tocá para empezar a escribir."}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={note.pinned ? "Desfijar nota" : "Fijar nota"}
                      hitSlop={8}
                      onPress={() => togglePin(note)}
                      style={({ pressed }) => [styles.pinBtn, pressed && { opacity: 0.7 }]}
                    >
                      <Feather
                        name="bookmark"
                        size={16}
                        color={note.pinned ? colors.accentText : colors.textMuted}
                      />
                    </Pressable>
                  </View>

                  {hasLinks ? (
                    <View style={styles.linksRow}>
                      {note.folders.map((folder) => (
                        <Pill
                          key={`f-${folder.id}`}
                          icon="folder"
                          label={folder.name}
                          color={colors.accentText}
                          onPress={() => router.push(`/carpetas/${folder.id}`)}
                        />
                      ))}
                      {note.decks.map((deck) => (
                        <Pill
                          key={`d-${deck.id}`}
                          icon="layers"
                          label={deck.name}
                          color={colors.accentText}
                          onPress={() => router.push(`/mazos/${deck.id}`)}
                        />
                      ))}
                      {note.tags.map((tag) => (
                        <Pill
                          key={`t-${tag.id}`}
                          label={`#${tag.name}`}
                          onPress={() => setTagId((prev) => (prev === tag.id ? null : tag.id))}
                        />
                      ))}
                    </View>
                  ) : null}
                </Card>
              );
            }}
            ListEmptyComponent={
              <View style={{ gap: spacing.sm }}>
                <EmptyState
                  icon={hasFilters ? "search" : "file-text"}
                  text={
                    hasFilters
                      ? "No hay notas que coincidan con tu búsqueda o filtros."
                      : "Todavía no creaste notas. Usalas como mapa previo o respaldo completo para tus mazos y carpetas."
                  }
                />
                {hasFilters ? (
                  <Button label="Ver todas las notas" onPress={clearFilters} />
                ) : (
                  <Button label="Crear tu primera nota" kind="primary" onPress={onCreateNote} />
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
              <Card
                key={folder.id}
                onPress={() => {
                  setDeckId(null);
                  setFolderId(folder.id);
                  setPicker(null);
                }}
                style={[
                  { marginLeft: Math.min(folder.depth, 4) * 14, padding: spacing.sm + 2 },
                  folderId === folder.id && { borderColor: colors.accentText },
                ]}
              >
                <Text style={type.body}>{folder.name}</Text>
                {folder.parent_id != null ? (
                  <Text style={type.small}>{locationLabel(folders, folder.parent_id)}</Text>
                ) : null}
              </Card>
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
              <Card
                key={deck.id}
                onPress={() => {
                  setFolderId(null);
                  setDeckId(deck.id);
                  setPicker(null);
                }}
                style={[
                  { padding: spacing.sm + 2 },
                  deckId === deck.id && { borderColor: colors.accentText },
                ]}
              >
                <Text style={type.body}>{deck.name}</Text>
                <Text style={type.small}>{locationLabel(folders, deck.folder_id)}</Text>
              </Card>
            ))}
          </ScrollView>
        </ActionSheet>

        <Toast message={error} onRetry={load} />
      </Screen>
    </SectionSwipe>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  clearBtn: {
    position: "absolute",
    right: 10,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  noteCard: {
    gap: spacing.sm,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  cardMainPress: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  noteTitle: {
    ...font(600),
    color: colors.text,
    fontSize: 16,
    flex: 1,
  },
  pinBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  linksRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
});
