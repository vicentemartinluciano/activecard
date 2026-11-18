import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { listDecks } from '../db/decks';
import { getDb } from '../db/client';
import { subscribeDatabaseChanges } from '../db/transactions';
import { listFolders } from '../db/folders';
import { createNote, listNotes } from '../db/notes';
import { folderPath } from '../lib/folderTree';
import { DESKTOP_INDEX_WIDTH, DESKTOP_RAIL_WIDTH, desktopSection, hasLibraryIndex, hasNotesIndex, libraryTree } from '../lib/desktopLayout';
import { normalizeSearch } from '../lib/search';
import { colors, font } from '../theme';
import { syncIndicator } from '../lib/syncIndicator';
import { Field } from './ui';
import { useCloudSync } from './CloudSyncProvider';
import CreationSheet from './CreationSheet';

const sections = [
  ['inicio', 'Inicio', 'home', '/'],
  ['biblioteca', 'Biblioteca', 'book-open', '/biblioteca'],
  ['notas', 'Notas', 'file-text', '/notas'],
  ['gimnasio', 'Gimnasio', 'zap', '/gimnasio'],
  ['progreso', 'Progreso', 'trending-up', '/progreso'],
];

const DesktopNavigationContext = createContext(null);
const DesktopNotesLayoutContext = createContext(null);

// The persistent rail is outside the Stack: save the active editor before navigating.
export function useDesktopBeforeNavigate(save) {
  const register = useContext(DesktopNavigationContext);
  useFocusEffect(useCallback(() => register?.(save), [register, save]));
}

export function useDesktopNotesLayout() {
  return useContext(DesktopNotesLayoutContext);
}

function RailButton({ label, icon, active, onPress, sync, separator = false }) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  return <View style={[styles.railItem, separator && styles.settingsSeparator]}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }}
      accessibilityHint={sync?.label}
      onPress={onPress} onFocus={(event) => setFocused(!!event.currentTarget?.matches?.(':focus-visible'))} onBlur={() => setFocused(false)}
      onPointerDown={() => setFocused(false)}
      onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [styles.railButton, { backgroundColor: hovered || pressed ? colors.surfaceHigh : 'transparent', outlineStyle: focused ? 'solid' : 'none', outlineWidth: 2, outlineColor: colors.accentText, outlineOffset: -4 }]}>
      <View pointerEvents="none" style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={26} color={active || hovered || focused ? colors.accentText : colors.textMuted} />
        {sync && <View testID="settings-sync-indicator" style={{ position: 'absolute', width: 5, height: 5, borderRadius: 3, backgroundColor: sync.synced ? colors.successBright : colors.textMuted }} />}
      </View>
    </Pressable>
    {(hovered || focused) && <View pointerEvents="none" style={styles.tooltip}><Text style={styles.tooltipText}>{sync ? `${label} · ${sync.label}` : label}</Text></View>}
  </View>;
}

function FolderRow({ folder, isOpen, toggle, open }) {
  const [active, setActive] = useState(false);
  return <View style={styles.folderRow} onPointerEnter={() => setActive(true)} onPointerLeave={() => setActive(false)}
    onFocus={() => setActive(true)} onBlur={(event) => { if (!event.currentTarget?.contains?.(event.relatedTarget)) setActive(false); }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${isOpen ? 'Plegar' : 'Desplegar'} carpeta ${folder.name}`} accessibilityState={{ expanded: isOpen }}
      onPress={toggle} style={styles.chevron}>
      <Feather pointerEvents="none" name="chevron-right" size={18} color={colors.textMuted} style={{ opacity: active ? 1 : 0, transform: [{ rotate: isOpen ? '90deg' : '0deg' }], transition: 'opacity 160ms ease, transform 180ms ease' }} />
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`Abrir carpeta ${folder.name}`} title={folder.name} onPress={open}
      style={({ hovered }) => [styles.folderName, hovered && { backgroundColor: colors.surfaceHigh }]}>
      <Feather pointerEvents="none" name="folder" size={20} color={colors.textMuted} /><Text numberOfLines={1} style={styles.treeText}>{folder.name}</Text>
    </Pressable>
  </View>;
}

function DesktopWorkspace({ children }) {
  const router = useRouter();
  const path = usePathname();
  const syncStatus = useCloudSync()?.status;
  const { width } = useWindowDimensions();
  const [pinned, setPinned] = useState(() => width >= 760);
  const [preview, setPreview] = useState(false);
  const [handleActive, setHandleActive] = useState(false);
  const [folders, setFolders] = useState([]);
  const [decks, setDecks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const [noteFocused, setNoteFocused] = useState(false);
  const [noteWide, setNoteWide] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [creation, setCreation] = useState(null);
  const timer = useRef(null);
  const request = useRef(0);
  const navigationGuard = useRef(null);
  const navigating = useRef(false);
  const register = useCallback((save) => {
    navigationGuard.current = save;
    return () => { if (navigationGuard.current === save) navigationGuard.current = null; };
  }, []);
  const refresh = useCallback(async () => {
    const ticket = ++request.current;
    try {
      const [nextDecks, nextFolders, nextNotes] = await Promise.all([listDecks(), listFolders(), listNotes()]);
      if (ticket !== request.current) return;
      setDecks(nextDecks); setFolders(nextFolders); setNotes(nextNotes); setError('');
    } catch { if (ticket === request.current) setError('No pudimos cargar el índice.'); }
  }, []);
  const closePreview = useCallback(() => { clearTimeout(timer.current); setPreview(false); }, []);
  const leavePreview = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setPreview(false), 180); };
  useEffect(() => { refresh(); closePreview(); }, [path, refresh, closePreview]);
  useEffect(() => {
    let alive = true;
    let unsubscribe;
    getDb().then((db) => { if (alive) unsubscribe = subscribeDatabaseChanges(db, refresh); }).catch(() => {});
    return () => { alive = false; unsubscribe?.(); };
  }, [refresh]);
  useEffect(() => () => { clearTimeout(timer.current); request.current++; }, []);
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);
  useEffect(() => {
    if (!preview) return;
    const dismiss = (event) => {
      if (event.type === 'keydown' ? event.key === 'Escape' : !event.target.closest?.('[data-library-index], [data-library-toggle]')) closePreview();
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', dismiss); };
  }, [preview, closePreview]);
  const selectedId = Number(path.match(/^\/mazos\/(\d+)/)?.[1]);
  const selectedDeck = decks.find((deck) => deck.id === selectedId);
  const selectedFolder = selectedDeck?.folder_id || Number(path.match(/^\/carpetas\/(\d+)/)?.[1]);
  const currentFolder = folders.find((folder) => folder.id === selectedFolder);
  const selectedNoteId = Number(path.match(/^\/notas\/(\d+)/)?.[1]);
  const selectedNote = notes.find((note) => note.id === selectedNoteId);
  const activeNoteFocused = Boolean(selectedNoteId) && noteFocused;
  useEffect(() => {
    if (!selectedNoteId) setNoteFocused(false);
  }, [selectedNoteId]);
  useEffect(() => {
    if (activeNoteFocused) closePreview();
  }, [activeNoteFocused, closePreview]);
  useEffect(() => {
    if (selectedFolder) setExpanded((value) => ({ ...value, ...Object.fromEntries(folderPath(folders, selectedFolder).map((folder) => [folder.id, true])) }));
  }, [selectedFolder, folders]);
  const section = desktopSection(path);
  useEffect(() => { setQuery(''); }, [section]);
  const library = hasLibraryIndex(path);
  const notesIndex = hasNotesIndex(path);
  const hasSidebar = library || notesIndex;
  const narrow = width < 760;
  useEffect(() => { if (narrow) { setPinned(false); closePreview(); } }, [narrow, closePreview]);
  const shown = hasSidebar && !activeNoteFocused && (pinned || preview);
  const floating = narrow || !pinned;
  const hideToolbarForNote = Boolean(selectedNoteId) && !narrow;
  const tree = libraryTree(folders, decks, query);
  const needle = normalizeSearch(query.trim());
  const filteredNotes = needle
    ? notes.filter((note) =>
        normalizeSearch(
          `${note.title || ''} ${note.excerpt || ''} ${(note.folders || []).map((f) => f.name).join(' ')} ${(note.decks || []).map((d) => d.name).join(' ')}`
        ).includes(needle)
      )
    : notes;
  const pinnedNotes = !needle ? filteredNotes.filter((note) => note.pinned) : [];
  const open = async (route, ancestor = false) => {
    if (navigating.current || route === path) return;
    navigating.current = true;
    try {
      if (navigationGuard.current && await navigationGuard.current() === false) return;
      closePreview(); if (narrow) setPinned(false);
      // POP_TO vuelve por el stack de mazos/carpetas, pero no cambia la tab
      // activa cuando ya estamos en Inicio, Crear o Progreso.
      if (ancestor || route === '/biblioteca' && (path === '/biblioteca' || path.startsWith('/mazos') || path.startsWith('/carpetas')) || route === '/notas' && path.startsWith('/notas')) router.dismissTo(route);
      else router.navigate(route);
    } finally { navigating.current = false; }
  };
  const deckRow = (deck, child = false) => <Pressable key={deck.id} title={deck.name}
    accessibilityRole="button" accessibilityLabel={`Abrir mazo ${deck.name}`} accessibilityState={{ selected: selectedId === deck.id }}
    onPress={() => open(`/mazos/${deck.id}`)} style={({ hovered }) => [styles.treeRow, { paddingLeft: child ? 42 : 16, backgroundColor: hovered || selectedId === deck.id ? colors.surfaceHigh : 'transparent' }]}>
    <Feather pointerEvents="none" name="layers" size={19} color={selectedId === deck.id ? colors.accentText : colors.textMuted} />
    <Text numberOfLines={1} style={[styles.treeText, selectedId === deck.id && { color: colors.text }]}>{deck.name}</Text>
    <Text style={styles.count}>{deck.card_count}</Text>
  </Pressable>;
  const folderRow = (folder, depth = 0) => {
    const isOpen = !!query.trim() || !!expanded[folder.id];
    return <View key={folder.id} style={{ marginLeft: depth ? 14 : 0 }}>
      <FolderRow folder={folder} isOpen={isOpen} toggle={() => setExpanded((value) => ({ ...value, [folder.id]: !value[folder.id] }))} open={() => open(`/carpetas/${folder.id}`)} />
      <div aria-hidden={!isOpen} inert={!isOpen} style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 200ms ease', visibility: isOpen ? 'visible' : 'hidden' }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          {(folder.folders || []).map((child) => folderRow(child, depth + 1))}
          {folder.children.map((deck) => deckRow(deck, true))}
          {!folder.children.length && !folder.folders?.length && <Text style={styles.emptyFolder}>Carpeta vacía</Text>}
        </div>
      </div>
    </View>;
  };
  const noteRow = (note) => {
    const selected = selectedNoteId === note.id;
    const label = note.title?.trim() || 'Sin título';
    return (
      <Pressable
        key={note.id}
        title={label}
        accessibilityRole="button"
        accessibilityLabel={`Abrir nota ${label}`}
        accessibilityState={{ selected }}
        onPress={() => open(`/notas/${note.id}`)}
        style={({ hovered }) => [styles.noteRow, { backgroundColor: hovered || selected ? colors.surfaceHigh : 'transparent' }]}
      >
        <Text style={styles.noteEmoji}>{note.icon || '📄'}</Text>
        <Text numberOfLines={1} style={[styles.noteRowText, selected && { ...font(600) }]}>{label}</Text>
      </Pressable>
    );
  };
  const notesLayoutValue = {
    pinned,
    shown,
    focused: activeNoteFocused,
    wide: noteWide,
    togglePinned: () => {
      closePreview();
      setPinned((value) => !value);
    },
    previewEnter: () => {
      clearTimeout(timer.current);
      if (!pinned && !activeNoteFocused) setPreview(true);
    },
    previewLeave: leavePreview,
    toggleFocused: () => setNoteFocused((value) => !value),
    toggleWide: () => setNoteWide((value) => !value),
    goNotesRoot: () => open('/notas', true),
  };
  return <View style={styles.shell}>
    {!narrow && !activeNoteFocused && <View style={styles.rail}>
      <View style={styles.sections}>{sections.map(([key, label, icon, route]) => <RailButton key={key} label={label} icon={icon} active={section === key} onPress={() => open(route)} />)}</View>
      <RailButton separator label="Ajustes" icon="settings" active={section === 'ajustes'} sync={syncIndicator(syncStatus)} onPress={() => open('/ajustes')} />
    </View>}
    <View style={{ width: hasSidebar && pinned && !narrow && !activeNoteFocused ? DESKTOP_INDEX_WIDTH : 0, zIndex: 30, transition: 'width 220ms ease' }}>
      {hasSidebar && <View dataSet={{ libraryIndex: 'true' }} testID={notesIndex ? 'desktop-notes-index' : 'desktop-library-index'}
        onPointerEnter={() => { clearTimeout(timer.current); refresh(); }} onPointerLeave={leavePreview}
        // visibility also removes hidden links from keyboard navigation.
        pointerEvents={shown ? 'auto' : 'none'}
        style={[styles.index, { visibility: shown ? 'visible' : 'hidden', opacity: shown ? 1 : 0, transform: [{ translateX: shown ? 0 : -16 }], transition: `opacity 180ms ease, transform 220ms ease, visibility 0s ${shown ? '0s' : '220ms'}`, top: floating ? 48 : 0, bottom: floating ? 12 : 0 }, floating && styles.floating]}>
        {notesIndex ? (
          <View style={styles.notesHeader}>
            <View style={styles.notesHeaderRow}>
              <Text style={styles.notesHeaderTitle}>Notas</Text>
              <View style={styles.notesHeaderActions}>
                {!floating ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Contraer índice de notas"
                    onPress={() => { closePreview(); setPinned(false); }}
                    style={({ hovered }) => [styles.notesIconBtn, hovered && { backgroundColor: colors.surfaceHigh }]}
                  >
                    <Text style={styles.notesCollapseGlyph}>«</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Crear nota"
                  onPress={async () => {
                    if (navigationGuard.current && await navigationGuard.current() === false) return;
                    const id = await createNote();
                    closePreview();
                    if (narrow) setPinned(false);
                    router.navigate(`/notas/${id}`);
                  }}
                  style={({ hovered }) => [styles.notesIconBtn, hovered && { backgroundColor: colors.surfaceHigh }]}
                >
                  <Text style={styles.notesPlusGlyph}>+</Text>
                </Pressable>
              </View>
            </View>
            <Field
              accessibilityLabel="Buscar notas en el índice"
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar notas…"
              style={styles.notesSearch}
            />
          </View>
        ) : (
          <View style={styles.indexHeading}>
            <Field accessibilityLabel="Buscar carpetas y mazos" value={query} onChangeText={setQuery} placeholder="Buscar en el índice" style={styles.search} />
            <Pressable accessibilityRole="button" accessibilityLabel="Crear contenido" onPress={async () => {
              if (navigationGuard.current && await navigationGuard.current() === false) return;
              setCreation('choose');
            }} style={styles.smallButton}><Feather name="plus" size={17} color={colors.textMuted} /></Pressable>
          </View>
        )}
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          {error ? <Pressable accessibilityRole="button" onPress={refresh}><Text style={styles.error}>{error} Reintentar</Text></Pressable> : null}
          {notesIndex ? (
            <>
              {pinnedNotes.length > 0 ? (
                <View style={styles.noteGroup}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${pinnedOpen ? 'Plegar' : 'Desplegar'} notas fijadas`}
                    accessibilityState={{ expanded: pinnedOpen }}
                    onPress={() => setPinnedOpen((v) => !v)}
                    style={styles.noteGroupToggle}
                  >
                    <Text style={styles.noteGroupLabel}>Fijadas</Text>
                    <Feather name={pinnedOpen ? 'chevron-down' : 'chevron-right'} size={15} color={colors.textMuted} />
                  </Pressable>
                  {pinnedOpen ? pinnedNotes.map((note) => noteRow(note)) : null}
                </View>
              ) : null}
              {filteredNotes.map((note) => noteRow(note))}
              {!error && !filteredNotes.length ? <Text style={styles.error}>{needle ? 'Sin coincidencias.' : 'Todavía no hay notas.'}</Text> : null}
            </>
          ) : (
            <>
              {tree.folders.map((folder) => folderRow(folder))}
              {tree.loose.map((deck) => deckRow(deck))}
              {!error && !tree.folders.length && !tree.loose.length ? <Text style={styles.error}>{query ? 'Sin coincidencias.' : 'Todavía no hay mazos.'}</Text> : null}
            </>
          )}
        </ScrollView>
        {!floating && <Pressable accessibilityRole="button" accessibilityLabel={notesIndex ? 'Ocultar índice de notas' : 'Ocultar índice de biblioteca'}
          onHoverIn={() => setHandleActive(true)} onHoverOut={() => setHandleActive(false)} onFocus={() => setHandleActive(true)} onBlur={() => setHandleActive(false)}
          onPress={() => { closePreview(); setPinned(false); }} style={styles.edgeHandle}>
          <View pointerEvents="none" style={{ width: 2, height: 48, borderRadius: 2, backgroundColor: handleActive ? colors.textMuted : 'transparent' }} />
        </Pressable>}
      </View>}
    </View>
    <View style={styles.content}>
      {hasSidebar && !hideToolbarForNote && <View style={styles.toolbar}>
        <Pressable dataSet={{ libraryToggle: 'true' }} accessibilityRole="button" accessibilityLabel={pinned ? (notesIndex ? 'Ocultar índice de notas' : 'Ocultar índice de biblioteca') : (notesIndex ? 'Fijar índice de notas' : 'Fijar índice de biblioteca')}
          accessibilityState={{ expanded: shown }} onHoverIn={() => { clearTimeout(timer.current); if (!pinned) setPreview(true); }} onHoverOut={leavePreview}
          onPress={() => { closePreview(); setPinned((value) => !value); }} style={({ hovered }) => [styles.smallButton, hovered && { backgroundColor: colors.surfaceHigh }]}>
          <Feather pointerEvents="none" name="sidebar" size={18} color={colors.textMuted} />
        </Pressable>
        {notesIndex ? (
          <View accessibilityLabel="Ubicación en notas" style={styles.breadcrumbs}>
            <Pressable accessibilityRole="button" accessibilityLabel="Ir a Notas" onPress={() => open('/notas', true)} style={styles.crumb}><Text numberOfLines={1} style={styles.trail}>Notas</Text></Pressable>
            {selectedNote ? <><Text style={styles.trail}>/</Text><Text numberOfLines={1} style={[styles.trail, { color: colors.text, flexShrink: 1 }]}>{selectedNote.title?.trim() || 'Sin título'}</Text></> : null}
          </View>
        ) : (
          <View accessibilityLabel="Ubicación en la biblioteca" style={styles.breadcrumbs}>
            <Pressable accessibilityRole="button" accessibilityLabel="Ir a Biblioteca" onPress={() => open('/biblioteca', true)} style={styles.crumb}><Text numberOfLines={1} style={styles.trail}>Biblioteca</Text></Pressable>
            {currentFolder && folderPath(folders, currentFolder.id).map((folder) => <View key={folder.id} style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={styles.trail}>/</Text><Pressable accessibilityRole="button" accessibilityLabel={`Ir a carpeta ${folder.name}`} onPress={() => open(`/carpetas/${folder.id}`, true)} style={styles.crumb}><Text numberOfLines={1} style={styles.trail}>{folder.name}</Text></Pressable></View>)}
            {selectedDeck && <><Text style={styles.trail}>/</Text><Pressable accessibilityRole="button" accessibilityLabel={`Ir a mazo ${selectedDeck.name}`} onPress={() => open(`/mazos/${selectedDeck.id}`)} style={styles.crumb}><Text numberOfLines={1} style={styles.trail}>{selectedDeck.name}</Text></Pressable></>}
          </View>
        )}
      </View>}
      <View style={styles.navigator}>
        <DesktopNotesLayoutContext.Provider value={notesLayoutValue}>
          <DesktopNavigationContext.Provider value={register}>{children}</DesktopNavigationContext.Provider>
        </DesktopNotesLayoutContext.Provider>
      </View>
    </View>
    <CreationSheet kind={creation} folderId={currentFolder?.id ?? null} onClose={() => setCreation(null)} />
  </View>;
}

export default function DesktopShell({ children }) {
  return Platform.OS === 'web' ? <DesktopWorkspace>{children}</DesktopWorkspace> : children;
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
  rail: { width: DESKTOP_RAIL_WIDTH, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.border, zIndex: 50 },
  sections: { flex: 5, minHeight: 0, width: '100%' },
  railItem: { position: 'relative', flex: 1, minHeight: 56, width: '100%', justifyContent: 'center' },
  settingsSeparator: { borderTopWidth: 1, borderTopColor: colors.border },
  railButton: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  tooltip: { position: 'absolute', left: DESKTOP_RAIL_WIDTH + 8, top: '50%', transform: [{ translateY: -16 }], paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, backgroundColor: colors.surfaceHigh },
  tooltipText: { ...font(600), color: colors.text, fontSize: 14, whiteSpace: 'nowrap' },
  index: { position: 'absolute', left: 0, width: DESKTOP_INDEX_WIDTH, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border },
  floating: { borderRadius: 10, boxShadow: '8px 0 24px rgba(0,0,0,0.3)' },
  indexHeading: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 12 },
  notesHeader: { padding: 14, gap: 10 },
  notesHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notesHeaderTitle: { ...font(600), fontSize: 18, color: colors.text },
  notesHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  notesIconBtn: { width: 34, height: 34, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  notesCollapseGlyph: { fontSize: 20, color: colors.textMuted, lineHeight: 22 },
  notesPlusGlyph: { fontSize: 20, color: colors.text, lineHeight: 22 },
  notesSearch: { minHeight: 38, height: 38, paddingVertical: 7, paddingHorizontal: 12, fontSize: 14, borderRadius: 7, backgroundColor: colors.bg },
  smallButton: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  search: { flex: 1, minWidth: 0, fontSize: 14, paddingHorizontal: 10, paddingVertical: 10 },
  treeRow: { width: '100%', flexDirection: 'row', alignItems: 'center', minHeight: 46, gap: 10, paddingRight: 16 },
  treeText: { ...font(), color: colors.textMuted, fontSize: 15.5, lineHeight: 22, flex: 1 },
  count: { ...font(), color: colors.textMuted, fontSize: 13 },
  folderRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 6 },
  chevron: { width: 30, height: 46, justifyContent: 'center', alignItems: 'center' },
  folderName: { flex: 1, flexDirection: 'row', minHeight: 46, alignItems: 'center', gap: 10, paddingRight: 16, borderRadius: 5 },
  emptyFolder: { ...font(), color: colors.textMuted, fontSize: 14, lineHeight: 21, paddingLeft: 38, paddingVertical: 8 },
  noteGroup: { paddingHorizontal: 8, paddingBottom: 6, marginBottom: 4 },
  noteGroupToggle: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
  noteGroupLabel: { ...font(), fontSize: 13, color: colors.textMuted },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 42, marginHorizontal: 8, paddingHorizontal: 10, borderRadius: 6 },
  noteEmoji: { width: 24, textAlign: 'center', fontSize: 19, lineHeight: 24 },
  noteRowText: { ...font(), color: colors.text, fontSize: 15.5, lineHeight: 22, flex: 1 },
  error: { ...font(), color: colors.textMuted, fontSize: 14, lineHeight: 21, padding: 16 },
  edgeHandle: { position: 'absolute', right: -6, top: 52, bottom: 0, width: 12, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, minWidth: 0, minHeight: 0 },
  toolbar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  breadcrumbs: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  crumb: { flexShrink: 1, minWidth: 0, paddingHorizontal: 4, paddingVertical: 8 },
  trail: { ...font(), color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  navigator: { flex: 1, minWidth: 0, minHeight: 0 },
});
