import Feather from "@expo/vector-icons/Feather";
import { Stack, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import ActionSheet from "../../components/ActionSheet";
import { useDesktopBeforeNavigate } from "../../components/DesktopShell";
import NoteAssociationsSheet from "../../components/NoteAssociationsSheet";
import NotionField from "../../components/NotionField";
import Skeleton from "../../components/Skeleton";
import Toast from "../../components/Toast";
import { useSyncRefresh } from "../../components/useSyncRefresh";
import { Button, EmptyState, Pill, Screen } from "../../components/ui";
import { ensureTag, listDecks, listTags } from "../../db/decks";
import { listFolders } from "../../db/folders";
import {
  deleteNote,
  duplicateNote,
  getNote,
  setNoteDecks,
  setNoteFolders,
  setNoteTags,
  updateNote,
} from "../../db/notes";
import { databaseErrorMessage } from "../../lib/databaseError";
import { colors, font, radius, spacing, type } from "../../theme";

export default function NotaDetalle() {
  const { id } = useLocalSearchParams();
  const noteId = Number(id);
  const router = useRouter();
  const navigation = useNavigation();

  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(0);
  const [folders, setFolders] = useState([]);
  const [decks, setDecks] = useState([]);
  const [tags, setTags] = useState([]);
  const [allFolders, setAllFolders] = useState([]);
  const [allDecks, setAllDecks] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [assocOpen, setAssocOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState("");
  const [syncReload, setSyncReload] = useState(0);

  const latestRef = useRef({ title: "", body: "", pinned: 0 });
  const persistedRef = useRef({ title: "", body: "", pinned: 0 });
  const timerRef = useRef(null);
  const flushRef = useRef(null);
  const deletedRef = useRef(false);
  const allowNavRef = useRef(false);
  const navSavingRef = useRef(false);

  useSyncRefresh(useCallback(() => setSyncReload((v) => v + 1), []));

  const isDirty = () =>
    latestRef.current.title !== persistedRef.current.title ||
    latestRef.current.body !== persistedRef.current.body ||
    latestRef.current.pinned !== persistedRef.current.pinned;

  const flush = useCallback(async () => {
    clearTimeout(timerRef.current);
    if (deletedRef.current || missing || !loaded) return true;
    if (flushRef.current) return flushRef.current;
    flushRef.current = (async () => {
      try {
        while (
          !deletedRef.current &&
          (latestRef.current.title !== persistedRef.current.title ||
            latestRef.current.body !== persistedRef.current.body ||
            latestRef.current.pinned !== persistedRef.current.pinned)
        ) {
          const snapshot = { ...latestRef.current };
          const updated = await updateNote(noteId, snapshot);
          if (!updated) {
            setMissing(true);
            return true;
          }
          persistedRef.current = snapshot;
        }
        setError("");
        return true;
      } catch (err) {
        setError(databaseErrorMessage(err, "No pudimos guardar la nota. Tu edición sigue abierta."));
        return false;
      }
    })().finally(() => {
      flushRef.current = null;
    });
    return flushRef.current;
  }, [noteId, missing, loaded]);

  useEffect(() => {
    let alive = true;
    if (syncReload > 0 && isDirty()) {
      setError("La biblioteca se actualizó. Conservamos tu edición abierta en esta nota.");
      return;
    }
    Promise.all([getNote(noteId), listFolders(), listDecks(), listTags()])
      .then(([note, loadedFolders, loadedDecks, loadedTags]) => {
        if (!alive) return;
        setAllFolders(loadedFolders);
        setAllDecks(loadedDecks);
        setAllTags(loadedTags);
        if (!note) {
          setMissing(true);
          setLoaded(true);
          return;
        }
        setMissing(false);
        const initial = { title: note.title || "", body: note.body || "", pinned: note.pinned ? 1 : 0 };
        latestRef.current = initial;
        persistedRef.current = initial;
        setTitle(initial.title);
        setBody(initial.body);
        setPinned(initial.pinned);
        setFolders(note.folders || []);
        setDecks(note.decks || []);
        setTags(note.tags || []);
        setLoaded(true);
        setError("");
      })
      .catch((err) => {
        if (alive) {
          setError(databaseErrorMessage(err, "No pudimos cargar la nota."));
          setLoaded(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [noteId, syncReload]);

  useDesktopBeforeNavigate(flush);

  useEffect(() => {
    return navigation.addListener("beforeRemove", (event) => {
      if (!isDirty() || allowNavRef.current || deletedRef.current) return;
      event.preventDefault();
      if (navSavingRef.current) return;
      navSavingRef.current = true;
      flush()
        .then((ok) => {
          if (ok) {
            allowNavRef.current = true;
            navigation.dispatch(event.data.action);
          }
        })
        .finally(() => {
          navSavingRef.current = false;
        });
    });
  }, [navigation, flush]);

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      if (!deletedRef.current) flush();
    };
  }, [flush]);

  const scheduleSave = (patch) => {
    latestRef.current = { ...latestRef.current, ...patch };
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      flush();
    }, 350);
  };

  const handleTitleChange = (nextTitle) => {
    setTitle(nextTitle);
    scheduleSave({ title: nextTitle });
  };

  const handleBodyChange = (nextBody) => {
    setBody(nextBody);
    scheduleSave({ body: nextBody });
  };

  const togglePinned = async () => {
    const next = pinned ? 0 : 1;
    setPinned(next);
    latestRef.current = { ...latestRef.current, pinned: next };
    await flush();
  };

  const navigateWithSave = async (route) => {
    const ok = await flush();
    if (!ok) return;
    allowNavRef.current = true;
    router.push(route);
  };

  const goBack = async () => {
    const ok = await flush();
    if (!ok) return;
    allowNavRef.current = true;
    if (router.canGoBack()) router.back();
    else router.replace("/notas");
  };

  const saveFolders = async (nextIds) => {
    await setNoteFolders(noteId, nextIds);
    const idSet = new Set(nextIds);
    setFolders(allFolders.filter((f) => idSet.has(f.id)));
  };

  const saveDecks = async (nextIds) => {
    await setNoteDecks(noteId, nextIds);
    const idSet = new Set(nextIds);
    setDecks(allDecks.filter((d) => idSet.has(d.id)));
  };

  const saveTags = async (nextIds) => {
    await setNoteTags(noteId, nextIds);
    const idSet = new Set(nextIds);
    setTags(allTags.filter((t) => idSet.has(t.id)));
  };

  const createAndAttachTag = async (name) => {
    const newTagId = await ensureTag(name);
    const nextTags = await listTags();
    setAllTags(nextTags);
    const currentIds = tags.map((t) => t.id);
    if (!currentIds.includes(newTagId)) {
      const nextIds = [...currentIds, newTagId];
      await setNoteTags(noteId, nextIds);
      const idSet = new Set(nextIds);
      setTags(nextTags.filter((t) => idSet.has(t.id)));
    }
  };

  const onDuplicate = async () => {
    const ok = await flush();
    if (!ok) return;
    try {
      const copyId = await duplicateNote(noteId);
      if (copyId) {
        allowNavRef.current = true;
        router.push(`/notas/${copyId}`);
      }
    } catch (err) {
      setError(databaseErrorMessage(err, "No pudimos duplicar la nota."));
    }
  };

  if (!loaded) {
    return (
      <Screen safeTop>
        <Stack.Screen options={{ headerShown: false }} />
        <Skeleton height={44} />
        <Skeleton height={280} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  if (missing) {
    return (
      <Screen safeTop>
        <Stack.Screen options={{ headerShown: false }} />
        <EmptyState full icon="file-text" text="Esta nota ya no está disponible." />
        <Button label="Ir a Notas" kind="primary" onPress={() => router.replace("/notas")} />
      </Screen>
    );
  }

  const hasLinks = folders.length > 0 || decks.length > 0 || tags.length > 0;

  return (
    <Screen safeTop style={Platform.OS === "web" ? styles.webScreen : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={goBack}
            style={({ pressed, hovered }) => [
              styles.backBtn,
              hovered && styles.ghostHover,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Feather name="arrow-left" size={18} color={colors.textMuted} />
            <Text style={styles.backText}>Notas</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={pinned ? "Desfijar nota" : "Fijar nota"}
            onPress={togglePinned}
            style={({ pressed, hovered }) => [
              styles.iconBtn,
              hovered && styles.ghostHover,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Feather name="bookmark" size={18} color={pinned ? colors.accentText : colors.textMuted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Vincular a mazos, carpetas o etiquetas"
            onPress={() => setAssocOpen(true)}
            style={({ pressed, hovered }) => [
              styles.iconBtn,
              hovered && styles.ghostHover,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Feather name="link-2" size={18} color={hasLinks ? colors.accentText : colors.textMuted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Opciones de la nota"
            onPress={() => setMenuOpen(true)}
            style={({ pressed, hovered }) => [
              styles.iconBtn,
              hovered && styles.ghostHover,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Feather name="more-horizontal" size={19} color={colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.docScroll}
        >
          <TextInput
            accessibilityLabel="Título de la nota"
            value={title}
            onChangeText={handleTitleChange}
            placeholder="Sin título"
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.titleInput}
          />

          <View style={styles.linksRow}>
            {folders.map((folder) => (
              <Pill
                key={`f-${folder.id}`}
                icon="folder"
                label={folder.name}
                color={colors.accentText}
                onPress={() => navigateWithSave(`/carpetas/${folder.id}`)}
              />
            ))}
            {decks.map((deck) => (
              <Pill
                key={`d-${deck.id}`}
                icon="layers"
                label={deck.name}
                color={colors.accentText}
                onPress={() => navigateWithSave(`/mazos/${deck.id}`)}
              />
            ))}
            {tags.map((tag) => (
              <Pill
                key={`t-${tag.id}`}
                label={`#${tag.name}`}
                onPress={() => setAssocOpen(true)}
              />
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Editar vínculos de la nota"
              onPress={() => setAssocOpen(true)}
              style={({ pressed, hovered }) => [
                styles.ghostLinkBtn,
                hovered && styles.ghostHover,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather name="plus" size={13} color={colors.textMuted} />
              {!hasLinks ? <Text style={styles.ghostLinkLabel}>Vincular mazo o carpeta</Text> : null}
            </Pressable>
          </View>

          <View style={styles.divider} />

          <NotionField
            page
            value={body}
            onChangeText={handleBodyChange}
            placeholder="Escribí algo…"
            minHeight={440}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <NoteAssociationsSheet
        visible={assocOpen}
        onClose={() => setAssocOpen(false)}
        folders={allFolders}
        decks={allDecks}
        allTags={allTags}
        selectedFolderIds={folders.map((f) => f.id)}
        selectedDeckIds={decks.map((d) => d.id)}
        selectedTagIds={tags.map((t) => t.id)}
        onSaveFolders={saveFolders}
        onSaveDecks={saveDecks}
        onSaveTags={saveTags}
        onCreateTag={createAndAttachTag}
      />

      <ActionSheet
        visible={menuOpen}
        title={title.trim() || "Nota"}
        onClose={() => setMenuOpen(false)}
        options={[
          { icon: "link-2", label: "Vincular a mazos, carpetas o etiquetas", onPress: () => setAssocOpen(true) },
          { icon: "bookmark", label: pinned ? "Quitar de fijadas" : "Fijar arriba", onPress: togglePinned },
          { icon: "copy", label: "Duplicar nota", onPress: onDuplicate },
          { icon: "trash-2", label: "Eliminar nota", destructive: true, onPress: () => setDeleteOpen(true) },
        ]}
      />

      <ActionSheet
        visible={deleteOpen}
        title="Eliminar nota"
        onClose={() => setDeleteOpen(false)}
      >
        <Text style={type.body}>
          Se eliminará “{title.trim() || "Nota sin título"}” y sus vínculos con mazos y carpetas. Los mazos y tarjetas se conservan.
        </Text>
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
          <Button label="Cancelar" onPress={() => setDeleteOpen(false)} style={{ flex: 1 }} />
          <Button
            label="Eliminar"
            kind="danger"
            style={{ flex: 1 }}
            onPress={async () => {
              clearTimeout(timerRef.current);
              deletedRef.current = true;
              allowNavRef.current = true;
              setDeleteOpen(false);
              await deleteNote(noteId);
              router.replace("/notas");
            }}
          />
        </View>
      </ActionSheet>

      <Toast message={error} onRetry={flush} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  webScreen: {
    maxWidth: 740,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingBottom: spacing.xs,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 8,
    marginLeft: -8,
    borderRadius: radius.sm,
  },
  backText: {
    ...font(500),
    fontSize: 13.5,
    color: colors.textMuted,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostHover: {
    backgroundColor: colors.surfaceHigh,
  },
  docScroll: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl * 3,
  },
  titleInput: {
    ...font(700),
    fontSize: 30,
    lineHeight: 38,
    color: colors.text,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
    outlineStyle: Platform.OS === "web" ? "none" : undefined,
  },
  linksRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing.md,
  },
  ghostLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 28,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
  },
  ghostLinkLabel: {
    fontSize: 12.5,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
});
