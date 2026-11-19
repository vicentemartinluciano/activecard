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
  createNote,
  deleteNote,
  duplicateNote,
  getNote,
  listNotes,
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
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [icon, setIcon] = useState(null);
  const [iconOpen, setIconOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [fallbackNotes, setFallbackNotes] = useState([]);
  const [saving, setSaving] = useState(false);
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

  const latestRef = useRef({ title: "", description: "", body: "", icon: null, pinned: 0 });
  const persistedRef = useRef({ title: "", description: "", body: "", icon: null, pinned: 0 });
  const timerRef = useRef(null);
  const flushRef = useRef(null);
  const deletedRef = useRef(false);
  const allowNavRef = useRef(false);
  const navSavingRef = useRef(false);

  useSyncRefresh(useCallback(() => setSyncReload((v) => v + 1), []));

  const isDirty = () =>
    latestRef.current.title !== persistedRef.current.title ||
    latestRef.current.description !== persistedRef.current.description ||
    latestRef.current.body !== persistedRef.current.body ||
    latestRef.current.icon !== persistedRef.current.icon ||
    latestRef.current.pinned !== persistedRef.current.pinned;

  const flush = useCallback(async () => {
    clearTimeout(timerRef.current);
    if (deletedRef.current || missing || !loaded) return true;
    if (flushRef.current) return flushRef.current;
    flushRef.current = (async () => {
      try {
        setSaving(true);
        while (
          !deletedRef.current &&
          (latestRef.current.title !== persistedRef.current.title ||
            latestRef.current.description !== persistedRef.current.description ||
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
      } finally {
        setSaving(false);
      }
    })().finally(() => {
      flushRef.current = null;
    });
    return flushRef.current;
  }, [noteId, missing, loaded]);

  useEffect(() => {
    let alive = true;
    setSwitcherOpen(false);
    setIconOpen(false);
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
          description: note.description || "",
          body: note.body || "",
          icon: note.icon || null,
          pinned: note.pinned ? 1 : 0,
        };
        latestRef.current = initial;
        persistedRef.current = initial;
        setTitle(initial.title);
        setDescription(initial.description);
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

  useEffect(() => {
    if (!switcherOpen) return;
    if (desktopLayout?.notes) return;
    let alive = true;
    Promise.resolve(listNotes())
      .then((rows) => {
        if (alive && Array.isArray(rows)) setFallbackNotes(rows);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [switcherOpen, desktopLayout?.notes]);

  useEffect(() => {
    if (!switcherOpen || Platform.OS !== "web" || typeof document === "undefined") return;
    const onPointerDown = (event) => {
      if (!event.target?.closest?.("[data-note-switcher], [data-note-switcher-trigger]")) {
        setSwitcherOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setSwitcherOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [switcherOpen]);

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

  const handleDescriptionChange = (nextDescription) => {
    setDescription(nextDescription);
    scheduleSave({ description: nextDescription });
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

  const openAnotherNote = async (targetId) => {
    setSwitcherOpen(false);
    if (Number(targetId) === noteId) return;
    if (desktopLayout?.openNote) {
      await desktopLayout.openNote(targetId);
      return;
    }
    await navigateWithSave(`/notas/${targetId}`);
  };

  const createAnotherNote = async () => {
    setSwitcherOpen(false);
    if (desktopLayout?.createNote) {
      await desktopLayout.createNote();
      return;
    }
    const ok = await flush();
    if (!ok) return;
    const newId = await createNote();
    allowNavRef.current = true;
    router.push(`/notas/${newId}`);
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

  const totalLinks = folders.length + decks.length + tags.length;
  const hasLinks = totalLinks > 0;
  const noteTitleLabel = title.trim() || "Sin título";
  const switcherNotes = desktopLayout?.notes || fallbackNotes;

  return (
    <Screen safeTop style={desktopWorkspace ? styles.desktopDocScreen : Platform.OS === "web" ? styles.webScreen : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
      >
        {desktopWorkspace ? (
          <View style={styles.desktopHeaderWrap}>
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
                <Pressable
                  dataSet={{ noteSwitcherTrigger: "true" }}
                  accessibilityRole="button"
                  accessibilityLabel="Cambiar de nota"
                  accessibilityState={{ expanded: switcherOpen }}
                  onPress={() => setSwitcherOpen((open) => !open)}
                  style={({ hovered, pressed }) => [
                    styles.crumbSwitcher,
                    (hovered || switcherOpen) && styles.crumbSwitcherActive,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={styles.crumbEmoji}>{icon || "📄"}</Text>
                  <Text numberOfLines={1} style={styles.crumbCurrent}>
                    {noteTitleLabel}
                  </Text>
                  <Feather
                    name={switcherOpen ? "chevron-up" : "chevron-down"}
                    size={15}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>

              <View style={styles.desktopTopActions}>
                <View
                  pointerEvents="none"
                  style={[styles.savingDot, { opacity: saving ? 1 : 0 }]}
                />

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={pinned ? "Desfijar nota" : "Fijar nota"}
                  accessibilityState={{ selected: !!pinned }}
                  onPress={togglePinned}
                  style={({ pressed, hovered }) => [
                    styles.iconBtn,
                    pinned && styles.iconBtnLit,
                    hovered && !pinned && styles.ghostHover,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Feather name="bookmark" size={17} color={pinned ? colors.accentText : colors.textMuted} />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Vincular a mazos, carpetas o etiquetas"
                  onPress={() => setAssocOpen(true)}
                  style={({ pressed, hovered }) => [
                    styles.linkCounterBtn,
                    hasLinks && styles.linkCounterBtnLit,
                    hovered && !hasLinks && styles.ghostHover,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Feather name="link-2" size={16} color={hasLinks ? colors.accentText : colors.textMuted} />
                  {hasLinks ? <Text style={styles.linkCounterText}>{totalLinks}</Text> : null}
                </Pressable>

                <View style={styles.topDivider} />

                <View style={styles.viewSegment}>
                  {showWideToggle ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={wide ? "Usar ancho de lectura" : "Usar ancho completo"}
                      accessibilityState={{ selected: wide }}
                      onPress={toggleWide}
                      style={({ pressed, hovered }) => [
                        styles.segmentBtn,
                        wide && styles.segmentBtnActive,
                        hovered && !wide && styles.ghostHover,
                        pressed && { opacity: 0.75 },
                      ]}
                    >
                      <Feather
                        name="columns"
                        size={14}
                        color={wide ? colors.accentText : colors.textMuted}
                      />
                      <Text style={[styles.segmentText, wide && styles.segmentTextActive]}>
                        {wide ? "Lectura" : "Ancho"}
                      </Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={focused ? "Restaurar vista de notas" : "Expandir nota"}
                    accessibilityState={{ selected: focused }}
                    onPress={toggleFocused}
                    style={({ pressed, hovered }) => [
                      styles.segmentBtn,
                      focused && styles.segmentBtnActive,
                      hovered && !focused && styles.ghostHover,
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <Feather
                      name={focused ? "minimize-2" : "maximize-2"}
                      size={14}
                      color={focused ? colors.accentText : colors.textMuted}
                    />
                    <Text style={[styles.segmentText, focused && styles.segmentTextActive]}>
                      {focused ? "Salir" : "Pantalla completa"}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.topDivider} />

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
                  <Feather name="x" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>

            {switcherOpen ? (
              <View
                testID="note-top-switcher"
                dataSet={{ noteSwitcher: "true", acMenu: "true" }}
                style={styles.switcherPopover}
              >
                <View style={styles.switcherHead}>
                  <Text style={styles.switcherHeadTitle}>Cambiar de nota</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Crear nota desde el índice superior"
                    onPress={createAnotherNote}
                    style={({ hovered, pressed }) => [
                      styles.switcherNewBtn,
                      hovered && styles.ghostHover,
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <Feather name="plus" size={14} color={colors.accentText} />
                    <Text style={styles.switcherNewText}>Nueva</Text>
                  </Pressable>
                </View>
                <ScrollView style={styles.switcherScroll} keyboardShouldPersistTaps="handled">
                  {switcherNotes.length > 0 ? (
                    switcherNotes.map((item) => {
                      const active = Number(item.id) === noteId;
                      const itemTitle = item.title?.trim() || "Sin título";
                      const sub = item.description?.trim() || "";
                      return (
                        <Pressable
                          key={item.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Ir a nota ${itemTitle}`}
                          accessibilityState={{ selected: active }}
                          onPress={() => openAnotherNote(item.id)}
                          style={({ hovered, pressed }) => [
                            styles.switcherRow,
                            active && styles.switcherRowActive,
                            hovered && !active && styles.ghostHover,
                            pressed && { opacity: 0.75 },
                          ]}
                        >
                          <Text style={styles.switcherRowEmoji}>{item.icon || "📄"}</Text>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              numberOfLines={1}
                              style={[styles.switcherRowTitle, active && { color: colors.text, ...font(600) }]}
                            >
                              {itemTitle}
                            </Text>
                            {sub ? (
                              <Text numberOfLines={1} style={styles.switcherRowSub}>
                                {sub}
                              </Text>
                            ) : null}
                          </View>
                          {active ? <Feather name="check" size={15} color={colors.accentText} /> : null}
                        </Pressable>
                      );
                    })
                  ) : (
                    <Text style={styles.switcherEmpty}>Esta es tu única nota.</Text>
                  )}
                </ScrollView>
              </View>
            ) : null}
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
                pinned && styles.iconBtnLit,
                hovered && !pinned && styles.ghostHover,
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
                hasLinks && styles.iconBtnLit,
                hovered && !hasLinks && styles.ghostHover,
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
            desktopWorkspace && { paddingHorizontal: pagePadding, paddingTop: focused ? 32 : 24 },
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
            {/* Franja superior de vinculación: arriba del ícono y el título */}
            <View testID="note-top-links" style={styles.topLinksStrip}>
              {folders.map((folder) => (
                <Pill
                  key={`f-${folder.id}`}
                  icon="folder"
                  label={folder.name}
                  color={colors.accentText}
                  style={[styles.linkPill, desktopWorkspace && styles.desktopLinkPill]}
                  labelStyle={[styles.linkPillLabel, desktopWorkspace && styles.desktopLinkPillLabel]}
                  onPress={() => navigateWithSave(`/carpetas/${folder.id}`)}
                />
              ))}
              {decks.map((deck) => (
                <Pill
                  key={`d-${deck.id}`}
                  icon="layers"
                  label={deck.name}
                  color={colors.accentText}
                  style={[styles.linkPill, desktopWorkspace && styles.desktopLinkPill]}
                  labelStyle={[styles.linkPillLabel, desktopWorkspace && styles.desktopLinkPillLabel]}
                  onPress={() => navigateWithSave(`/mazos/${deck.id}`)}
                />
              ))}
              {tags.map((tag) => (
                <Pill
                  key={`t-${tag.id}`}
                  label={`#${tag.name}`}
                  style={[styles.tagPill, desktopWorkspace && styles.desktopLinkPill]}
                  labelStyle={[styles.linkPillLabel, desktopWorkspace && styles.desktopLinkPillLabel]}
                  onPress={() => setAssocOpen(true)}
                />
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Editar vínculos de la nota"
                onPress={() => setAssocOpen(true)}
                style={({ pressed, hovered }) => [
                  styles.ghostLinkBtn,
                  desktopWorkspace && styles.desktopLinkPill,
                  hovered && styles.ghostHover,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Feather name="plus" size={desktopWorkspace ? 14 : 13} color={colors.textMuted} />
                <Text style={[styles.ghostLinkLabel, desktopWorkspace && styles.desktopGhostLinkLabel]}>
                  {hasLinks ? "Vincular" : "Vincular a mazo o carpeta"}
                </Text>
              </Pressable>
            </View>

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
              <View dataSet={{ acMenu: "true" }} style={styles.iconGrid}>
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
              placeholderTextColor="#5C6175"
              multiline
              style={[styles.titleInput, desktopWorkspace && styles.desktopTitleInput]}
            />

            <TextInput
              accessibilityLabel="Descripción de la nota"
              value={description}
              onChangeText={handleDescriptionChange}
              placeholder="Añadir una descripción…"
              placeholderTextColor="#5C6175"
              maxLength={240}
              multiline
              style={[styles.descriptionInput, desktopWorkspace && styles.desktopDescriptionInput]}
            />

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
  desktopHeaderWrap: {
    position: "relative",
    zIndex: 40,
  },
  desktopTopBar: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    backgroundColor: "rgba(6, 6, 8, 0.82)",
    ...(Platform.OS === "web" ? { backdropFilter: "blur(12px)" } : {}),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  desktopBreadcrumbs: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  crumbBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  crumbText: {
    ...font(500),
    fontSize: 14.5,
    lineHeight: 20,
    color: colors.textMuted,
  },
  crumbSep: {
    ...font(),
    fontSize: 14,
    color: "#52576B",
  },
  crumbSwitcher: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
    maxWidth: 320,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  crumbSwitcherActive: {
    backgroundColor: colors.surfaceHigh,
    borderColor: "rgba(255,255,255,0.09)",
  },
  crumbEmoji: {
    fontSize: 16,
    lineHeight: 20,
  },
  crumbCurrent: {
    ...font(600),
    fontSize: 14.5,
    lineHeight: 20,
    color: colors.text,
    flexShrink: 1,
  },
  desktopTopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  savingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginRight: 4,
  },
  linkCounterBtn: {
    minWidth: 36,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "transparent",
  },
  linkCounterBtnLit: {
    backgroundColor: "rgba(70,104,232,0.14)",
    borderColor: "rgba(155,180,255,0.22)",
  },
  linkCounterText: {
    ...font(600),
    fontSize: 12.5,
    color: colors.accentText,
  },
  topDivider: {
    width: 1,
    height: 18,
    backgroundColor: "rgba(255,255,255,0.09)",
    marginHorizontal: 3,
  },
  viewSegment: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    padding: 3,
    borderRadius: 10,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  segmentBtn: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    borderRadius: 7,
  },
  segmentBtnActive: {
    backgroundColor: "rgba(70,104,232,0.2)",
  },
  segmentText: {
    ...font(500),
    fontSize: 13,
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.accentText,
  },
  switcherPopover: {
    position: "absolute",
    top: 52,
    left: 56,
    width: 310,
    maxWidth: "90%",
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 8,
    ...(Platform.OS === "web" ? { boxShadow: "0 18px 48px rgba(0,0,0,0.65)" } : {}),
    zIndex: 60,
  },
  switcherHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 6,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  switcherHeadTitle: {
    ...font(600),
    fontSize: 12.5,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  switcherNewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  switcherNewText: {
    ...font(600),
    fontSize: 12.5,
    color: colors.accentText,
  },
  switcherScroll: {
    maxHeight: 300,
  },
  switcherRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
  },
  switcherRowActive: {
    backgroundColor: "rgba(70,104,232,0.15)",
  },
  switcherRowEmoji: {
    fontSize: 17,
    width: 22,
    textAlign: "center",
  },
  switcherRowTitle: {
    ...font(500),
    fontSize: 14,
    color: "#DCE0EC",
  },
  switcherRowSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  switcherEmpty: {
    fontSize: 13,
    color: colors.textMuted,
    padding: 12,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
    width: 36,
    height: 36,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnLit: {
    backgroundColor: "rgba(70,104,232,0.14)",
    borderColor: "rgba(155,180,255,0.22)",
  },
  ghostHover: {
    backgroundColor: colors.surfaceHigh,
  },
  docScroll: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl * 3,
    flexGrow: 1,
  },
  topLinksStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 7,
    marginBottom: 18,
  },
  linkPill: {
    minHeight: 28,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(70,104,232,0.13)",
    borderColor: "rgba(155,180,255,0.22)",
  },
  tagPill: {
    minHeight: 28,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.surfaceCard,
    borderColor: colors.cardBorder,
  },
  desktopLinkPill: {
    minHeight: 30,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  linkPillLabel: {
    fontSize: 12.5,
    ...font(500),
  },
  desktopLinkPillLabel: {
    fontSize: 13.5,
  },
  ghostLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  ghostLinkLabel: {
    ...font(500),
    fontSize: 12.5,
    color: colors.textMuted,
  },
  desktopGhostLinkLabel: {
    fontSize: 13,
  },
  emojiBtn: {
    alignSelf: "flex-start",
    minWidth: 52,
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
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
    borderRadius: 14,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    ...(Platform.OS === "web" ? { boxShadow: "0 14px 36px rgba(0,0,0,0.55)" } : {}),
    marginBottom: 14,
  },
  iconOption: {
    width: 40,
    height: 40,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  iconOptionActive: {
    backgroundColor: "rgba(70,104,232,0.2)",
  },
  iconOptionText: {
    fontSize: 22,
  },
  titleInput: {
    ...font(700),
    fontSize: 32,
    lineHeight: 40,
    color: colors.text,
    letterSpacing: -0.4,
    paddingVertical: 4,
    marginBottom: 4,
    outlineStyle: Platform.OS === "web" ? "none" : undefined,
  },
  desktopTitleInput: {
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: -0.6,
  },
  descriptionInput: {
    ...font(400),
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    paddingVertical: 4,
    marginBottom: 14,
    outlineStyle: Platform.OS === "web" ? "none" : undefined,
  },
  desktopDescriptionInput: {
    fontSize: 16.5,
    lineHeight: 25,
    marginBottom: 18,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginBottom: spacing.md,
  },
});
