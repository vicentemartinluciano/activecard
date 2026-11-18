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
  useWindowDimensions,
} from "react-native";

import ActionSheet from "../../components/ActionSheet";
import { useDesktopBeforeNavigate, useDesktopNotesLayout } from "../../components/DesktopShell";
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
import { DESKTOP_INDEX_WIDTH, DESKTOP_RAIL_WIDTH } from "../../lib/desktopLayout";
import { colors, font, radius, spacing, type } from "../../theme";

const NOTE_ICONS = [
  "📄", "📁", "📝", "📚", "💡", "🧭", "🌱", "🎯",
  "✨", "🧠", "💬", "❤️", "🏠", "🎓", "💼", "🎨",
  "🎵", "🏃", "🌍", "☀️", "🌙", "🔖", "⚓", "🪴",
];

export default function NotaDetalle() {
  const { id } = useLocalSearchParams();
  const noteId = Number(id);
  const router = useRouter();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const desktopWorkspace = Platform.OS === "web" && width >= 760;
  const desktopLayout = useDesktopNotesLayout();
  const [localFocused, setLocalFocused] = useState(false);
  const [localWide, setLocalWide] = useState(false);
  const focused = desktopLayout ? desktopLayout.focused : localFocused;
  const wide = desktopLayout ? desktopLayout.wide : localWide;
  const pinnedIndex = desktopLayout ? desktopLayout.pinned : false;
  const toggleFocused = desktopLayout ? desktopLayout.toggleFocused : () => setLocalFocused((v) => !v);
  const toggleWide = desktopLayout ? desktopLayout.toggleWide : () => setLocalWide((v) => !v);
  const paneWidth = width - (focused ? 0 : DESKTOP_RAIL_WIDTH) - (focused || !pinnedIndex ? 0 : DESKTOP_INDEX_WIDTH);
  const pagePadding = paneWidth < 680 ? 24 : paneWidth < 1040 ? 36 : 56;
  const showWideToggle = !focused && pinnedIndex && paneWidth >= 1120;
  const fullDocumentWidth = focused || wide || !pinnedIndex || paneWidth < 1120;

  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [icon, setIcon] = useState(null);
  const [iconOpen, setIconOpen] = useState(false);
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

  const latestRef = useRef({ title: "", body: "", icon: null, pinned: 0 });
  const persistedRef = useRef({ title: "", body: "", icon: null, pinned: 0 });
  const timerRef = useRef(null);
  const flushRef = useRef(null);
  const deletedRef = useRef(false);
  const allowNavRef = useRef(false);
  const navSavingRef = useRef(false);

  useSyncRefresh(useCallback(() => setSyncReload((v) => v + 1), []));

  const isDirty = () =>
    latestRef.current.title !== persistedRef.current.title ||
    latestRef.current.body !== persistedRef.current.body ||
    latestRef.current.icon !== persistedRef.current.icon ||
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
            latestRef.current.icon !== persistedRef.current.icon ||
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
        const initial = {
          title: note.title || "",
          body: note.body || "",
          icon: note.icon || null,
          pinned: note.pinned ? 1 : 0,
        };
        latestRef.current = initial;
        persistedRef.current = initial;
        setTitle(initial.title);
        setBody(initial.body);
        setIcon(initial.icon);
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

  const handleSelectIcon = async (nextIcon) => {
    setIcon(nextIcon);
    setIconOpen(false);
    latestRef.current = { ...latestRef.current, icon: nextIcon };
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
      <Screen safeTop style={desktopWorkspace ? [styles.desktopDocScreen, { padding: pagePadding }] : undefined}>
        <Stack.Screen options={{ headerShown: false }} />
        <Skeleton height={44} />
        <Skeleton height={280} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  if (missing) {
    return (
      <Screen safeTop style={desktopWorkspace ? [styles.desktopDocScreen, { padding: pagePadding }] : undefined}>
        <Stack.Screen options={{ headerShown: false }} />
        <EmptyState full icon="file-text" text="Esta nota ya no está disponible." />
        <Button label="Ir a Notas" kind="primary" onPress={() => router.replace("/notas")} />
      </Screen>
    );
  }

  const hasLinks = folders.length > 0 || decks.length > 0 || tags.length > 0;
  const noteTitleLabel = title.trim() || "Sin título";

  return (
    <Screen safeTop style={desktopWorkspace ? styles.desktopDocScreen : Platform.OS === "web" ? styles.webScreen : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
      >
        {desktopWorkspace ? (
          <View style={styles.desktopTopBar}>
            {!focused && desktopLayout ? (
              <Pressable
                dataSet={{ libraryToggle: "true" }}
                accessibilityRole="button"
                accessibilityLabel={pinnedIndex ? "Ocultar índice de notas" : "Fijar índice de notas"}
                accessibilityState={{ expanded: desktopLayout.shown }}
                onHoverIn={desktopLayout.previewEnter}
                onHoverOut={desktopLayout.previewLeave}
                onPress={desktopLayout.togglePinned}
                style={({ pressed, hovered }) => [
                  styles.iconBtn,
                  hovered && styles.ghostHover,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Feather pointerEvents="none" name="sidebar" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}

            <View accessibilityLabel="Ubicación en notas" style={styles.desktopBreadcrumbs}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ir a Notas"
                onPress={() => (desktopLayout ? desktopLayout.goNotesRoot() : navigateWithSave("/notas"))}
                style={({ hovered, pressed }) => [
                  styles.crumbBtn,
                  hovered && styles.ghostHover,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text numberOfLines={1} style={styles.crumbText}>Notas</Text>
              </Pressable>
              <Text style={styles.crumbSep}>/</Text>
              <Text numberOfLines={1} style={styles.crumbCurrent}>
                {`${icon || "📄"} ${noteTitleLabel}`}
              </Text>
            </View>

            <View style={styles.desktopTopActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={focused ? "Restaurar vista de notas" : "Expandir nota"}
                accessibilityState={{ selected: focused }}
                onPress={toggleFocused}
                style={({ pressed, hovered }) => [
                  styles.topActionBtn,
                  (focused || hovered) && styles.ghostHover,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Feather
                  name={focused ? "minimize-2" : "maximize-2"}
                  size={15}
                  color={focused ? colors.text : colors.textMuted}
                />
                <Text style={[styles.topActionText, focused && { color: colors.text }]}>
                  {focused ? "Salir" : "Pantalla completa"}
                </Text>
              </Pressable>

              {showWideToggle ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={wide ? "Usar ancho de lectura" : "Usar ancho completo"}
                  accessibilityState={{ selected: wide }}
                  onPress={toggleWide}
                  style={({ pressed, hovered }) => [
                    styles.topActionBtn,
                    (wide || hovered) && styles.ghostHover,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.topActionText, wide && { color: colors.text }]}>
                    {wide ? "Ancho de lectura" : "Ancho completo"}
                  </Text>
                </Pressable>
              ) : null}

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
                <Feather name="bookmark" size={19} color={pinned ? colors.accentText : colors.textMuted} />
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
                <Feather name="link-2" size={19} color={hasLinks ? colors.accentText : colors.textMuted} />
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
                <Feather name="more-horizontal" size={20} color={colors.textMuted} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar nota"
                onPress={goBack}
                style={({ pressed, hovered }) => [
                  styles.iconBtn,
                  hovered && styles.ghostHover,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Feather name="x" size={19} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>
        ) : (
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
        )}

        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.docScroll,
            desktopWorkspace && { paddingHorizontal: pagePadding, paddingTop: focused ? 28 : 24 },
          ]}
        >
          <View
            testID="note-document-column"
            style={
              desktopWorkspace
                ? {
                    width: "100%",
                    maxWidth: fullDocumentWidth ? undefined : 980,
                    alignSelf: "flex-start",
                  }
                : undefined
            }
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cambiar icono de la nota"
              accessibilityState={{ expanded: iconOpen }}
              onPress={() => setIconOpen((v) => !v)}
              style={({ pressed, hovered }) => [
                styles.emojiBtn,
                (hovered || iconOpen) && styles.ghostHover,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.emojiBtnText, desktopWorkspace && styles.desktopEmojiBtnText]}>
                {icon || "📄"}
              </Text>
            </Pressable>

            {iconOpen ? (
              <View style={styles.iconGrid}>
                {NOTE_ICONS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    accessibilityRole="button"
                    accessibilityLabel={`Usar icono ${emoji}`}
                    onPress={() => handleSelectIcon(emoji)}
                    style={({ hovered, pressed }) => [
                      styles.iconOption,
                      (icon || "📄") === emoji && styles.iconOptionActive,
                      hovered && styles.ghostHover,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={styles.iconOptionText}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <TextInput
              accessibilityLabel="Título de la nota"
              value={title}
              onChangeText={handleTitleChange}
              placeholder="Sin título"
              placeholderTextColor={colors.textMuted}
              multiline
              style={[styles.titleInput, desktopWorkspace && styles.desktopTitleInput]}
            />

            <View style={styles.linksRow}>
              {folders.map((folder) => (
                <Pill
                  key={`f-${folder.id}`}
                  icon="folder"
                  label={folder.name}
                  color={colors.accentText}
                  style={[styles.compactPill, desktopWorkspace && styles.desktopCompactPill]}
                  labelStyle={[styles.compactPillLabel, desktopWorkspace && styles.desktopCompactPillLabel]}
                  onPress={() => navigateWithSave(`/carpetas/${folder.id}`)}
                />
              ))}
              {decks.map((deck) => (
                <Pill
                  key={`d-${deck.id}`}
                  icon="layers"
                  label={deck.name}
                  color={colors.accentText}
                  style={[styles.compactPill, desktopWorkspace && styles.desktopCompactPill]}
                  labelStyle={[styles.compactPillLabel, desktopWorkspace && styles.desktopCompactPillLabel]}
                  onPress={() => navigateWithSave(`/mazos/${deck.id}`)}
                />
              ))}
              {tags.map((tag) => (
                <Pill
                  key={`t-${tag.id}`}
                  label={`#${tag.name}`}
                  style={[styles.compactPill, desktopWorkspace && styles.desktopCompactPill]}
                  labelStyle={[styles.compactPillLabel, desktopWorkspace && styles.desktopCompactPillLabel]}
                  onPress={() => setAssocOpen(true)}
                />
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Editar vínculos de la nota"
                onPress={() => setAssocOpen(true)}
                style={({ pressed, hovered }) => [
                  styles.ghostLinkBtn,
                  desktopWorkspace && styles.desktopCompactPill,
                  hovered && styles.ghostHover,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Feather name="plus" size={desktopWorkspace ? 15 : 14} color={colors.textMuted} />
                {!hasLinks ? (
                  <Text style={[styles.ghostLinkLabel, desktopWorkspace && styles.desktopGhostLinkLabel]}>
                    Vincular mazo o carpeta
                  </Text>
                ) : null}
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
          </View>
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
  desktopDocScreen: {
    maxWidth: "100%",
    width: "100%",
    padding: 0,
  },
  desktopTopBar: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  desktopBreadcrumbs: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  crumbBtn: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  crumbText: {
    ...font(),
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  crumbSep: {
    ...font(),
    fontSize: 15,
    color: colors.textMuted,
  },
  crumbCurrent: {
    ...font(500),
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    flexShrink: 1,
  },
  desktopTopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  topActionBtn: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
  },
  topActionText: {
    ...font(500),
    fontSize: 13.5,
    color: colors.textMuted,
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
    fontSize: 14.5,
    color: colors.textMuted,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostHover: {
    backgroundColor: colors.surfaceHigh,
  },
  docScroll: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl * 3,
    flexGrow: 1,
  },
  emojiBtn: {
    alignSelf: "flex-start",
    minWidth: 52,
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    marginBottom: 6,
    marginLeft: -6,
  },
  emojiBtnText: {
    fontSize: 36,
    lineHeight: 42,
  },
  desktopEmojiBtnText: {
    fontSize: 42,
    lineHeight: 48,
  },
  iconGrid: {
    maxWidth: 360,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    padding: 8,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  iconOption: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  iconOptionActive: {
    backgroundColor: colors.surfaceHigh,
  },
  iconOptionText: {
    fontSize: 22,
  },
  titleInput: {
    ...font(700),
    fontSize: 32,
    lineHeight: 40,
    color: colors.text,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
    outlineStyle: Platform.OS === "web" ? "none" : undefined,
  },
  desktopTitleInput: {
    fontSize: 38,
    lineHeight: 48,
  },
  linksRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: spacing.md,
  },
  compactPill: {
    minHeight: 28,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  desktopCompactPill: {
    minHeight: 30,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  compactPillLabel: {
    fontSize: 12.5,
    ...font(500),
  },
  desktopCompactPillLabel: {
    fontSize: 13.5,
  },
  ghostLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 28,
    paddingHorizontal: 9,
    borderRadius: 6,
  },
  ghostLinkLabel: {
    fontSize: 12.5,
    color: colors.textMuted,
  },
  desktopGhostLinkLabel: {
    fontSize: 13.5,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
});
