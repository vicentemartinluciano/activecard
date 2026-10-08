import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { listDecks } from '../db/decks';
import { listFolders } from '../db/folders';
import { DESKTOP_INDEX_WIDTH, DESKTOP_RAIL_WIDTH, desktopSection, hasLibraryIndex, libraryTree } from '../lib/desktopLayout';
import { colors, font } from '../theme';
import { Field } from './ui';
import { useCloudSync } from './CloudSyncProvider';

const sections = [
  ['inicio', 'Inicio', 'home', '/'],
  ['biblioteca', 'Biblioteca', 'book-open', '/biblioteca'],
  ['crear', 'Crear', 'plus-square', '/crear'],
  ['gimnasio', 'Gimnasio', 'zap', '/gimnasio/chat'],
  ['progreso', 'Progreso', 'trending-up', '/progreso'],
];

const DesktopNavigationContext = createContext(null);

// The persistent rail is outside the Stack: save the active editor before navigating.
export function useDesktopBeforeNavigate(save) {
  const register = useContext(DesktopNavigationContext);
  useFocusEffect(useCallback(() => register?.(save), [register, save]));
}

function RailButton({ label, icon, active, onPress, pending = false, separator = false }) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  return <View style={[styles.railItem, separator && styles.settingsSeparator]}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }}
      accessibilityHint={pending ? 'Hay cambios de otro dispositivo para incorporar en Ajustes' : undefined}
      onPress={onPress} onFocus={(event) => setFocused(!!event.currentTarget?.matches?.(':focus-visible'))} onBlur={() => setFocused(false)}
      onPointerDown={() => setFocused(false)}
      onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [styles.railButton, { backgroundColor: hovered || pressed ? colors.surfaceHigh : 'transparent', outlineStyle: focused ? 'solid' : 'none', outlineWidth: 2, outlineColor: colors.accentText, outlineOffset: -4 }]}>
      <Feather pointerEvents="none" name={icon} size={26} color={active || hovered || focused ? colors.accentText : colors.textMuted} />
      {pending && <View pointerEvents="none" style={{ position: 'absolute', right: 6, top: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accentText }} />}
    </Pressable>
    {(hovered || focused) && <View pointerEvents="none" style={styles.tooltip}><Text style={styles.tooltipText}>{pending ? `${label} · incorporar cambios` : label}</Text></View>}
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
  const [pinned, setPinned] = useState(true);
  const [preview, setPreview] = useState(false);
  const [handleActive, setHandleActive] = useState(false);
  const [folders, setFolders] = useState([]);
  const [decks, setDecks] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
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
      const [nextDecks, nextFolders] = await Promise.all([listDecks(), listFolders()]);
      if (ticket !== request.current) return;
      setDecks(nextDecks); setFolders(nextFolders); setError('');
    } catch { if (ticket === request.current) setError('No pudimos cargar el índice.'); }
  }, []);
  const closePreview = useCallback(() => { clearTimeout(timer.current); setPreview(false); }, []);
  const leavePreview = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setPreview(false), 180); };
  useEffect(() => { refresh(); closePreview(); }, [path, refresh, closePreview]);
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
  useEffect(() => { if (selectedFolder) setExpanded((value) => ({ ...value, [selectedFolder]: true })); }, [selectedFolder]);
  const section = desktopSection(path);
  const library = hasLibraryIndex(path);
  const narrow = width < 760;
  const shown = library && (pinned || preview);
  const floating = narrow || !pinned;
  const tree = libraryTree(folders, decks, query);
  const open = async (route) => {
    if (navigating.current || route === path) return;
    navigating.current = true;
    try {
      if (navigationGuard.current && await navigationGuard.current() === false) return;
      closePreview(); router.navigate(route);
    } finally { navigating.current = false; }
  };
  const deckRow = (deck, child = false) => <Pressable key={deck.id} title={deck.name}
    accessibilityRole="button" accessibilityLabel={`Abrir mazo ${deck.name}`} accessibilityState={{ selected: selectedId === deck.id }}
    onPress={() => open(`/mazos/${deck.id}`)} style={({ hovered }) => [styles.treeRow, { paddingLeft: child ? 42 : 16, backgroundColor: hovered || selectedId === deck.id ? colors.surfaceHigh : 'transparent' }]}>
    <Feather pointerEvents="none" name="layers" size={19} color={selectedId === deck.id ? colors.accentText : colors.textMuted} />
    <Text numberOfLines={1} style={[styles.treeText, selectedId === deck.id && { color: colors.text }]}>{deck.name}</Text>
    <Text style={styles.count}>{deck.card_count}</Text>
  </Pressable>;
  return <View style={styles.shell}>
    <View style={styles.rail}>
      <View style={styles.sections}>{sections.map(([key, label, icon, route]) => <RailButton key={key} label={label} icon={icon} active={section === key} onPress={() => open(route)} />)}</View>
      <RailButton separator label="Ajustes" icon="settings" active={section === 'ajustes'} pending={syncStatus?.pending} onPress={() => open('/ajustes')} />
    </View>
    <View style={{ width: library && pinned && !narrow ? DESKTOP_INDEX_WIDTH : 0, zIndex: 30, transition: 'width 220ms ease' }}>
      {library && <View dataSet={{ libraryIndex: 'true' }} testID="desktop-library-index"
        onPointerEnter={() => { clearTimeout(timer.current); refresh(); }} onPointerLeave={leavePreview}
        // visibility also removes hidden links from keyboard navigation.
        pointerEvents={shown ? 'auto' : 'none'}
        style={[styles.index, { visibility: shown ? 'visible' : 'hidden', opacity: shown ? 1 : 0, transform: [{ translateX: shown ? 0 : -16 }], transition: `opacity 180ms ease, transform 220ms ease, visibility 0s ${shown ? '0s' : '220ms'}`, top: floating ? 48 : 0, bottom: floating ? 12 : 0 }, floating && styles.floating]}>
        <View style={styles.indexHeading}>
          <Field accessibilityLabel="Buscar carpetas y mazos" value={query} onChangeText={setQuery} placeholder="Buscar en el índice" style={styles.search} />
          <Pressable accessibilityRole="button" accessibilityLabel="Crear contenido" onPress={() => open('/crear')} style={styles.smallButton}><Feather name="plus" size={17} color={colors.textMuted} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          {error ? <Pressable accessibilityRole="button" onPress={refresh}><Text style={styles.error}>{error} Reintentar</Text></Pressable> : null}
          {tree.folders.map((folder) => {
            const isOpen = !!query.trim() || !!expanded[folder.id];
            return <View key={folder.id}>
              <FolderRow folder={folder} isOpen={isOpen} toggle={() => setExpanded((value) => ({ ...value, [folder.id]: !value[folder.id] }))} open={() => open(`/carpetas/${folder.id}`)} />
              <div aria-hidden={!isOpen} inert={!isOpen} style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 200ms ease', visibility: isOpen ? 'visible' : 'hidden' }}>
                <div style={{ overflow: 'hidden', minHeight: 0 }}>{folder.children.length ? folder.children.map((deck) => deckRow(deck, true)) : <Text style={styles.emptyFolder}>Sin mazos</Text>}</div>
              </div>
            </View>;
          })}
          {tree.loose.map((deck) => deckRow(deck))}
          {!error && !tree.folders.length && !tree.loose.length && <Text style={styles.error}>{query ? 'Sin coincidencias.' : 'Todavía no hay mazos.'}</Text>}
        </ScrollView>
        {!floating && <Pressable accessibilityRole="button" accessibilityLabel="Ocultar índice de biblioteca"
          onHoverIn={() => setHandleActive(true)} onHoverOut={() => setHandleActive(false)} onFocus={() => setHandleActive(true)} onBlur={() => setHandleActive(false)}
          onPress={() => { closePreview(); setPinned(false); }} style={styles.edgeHandle}>
          <View pointerEvents="none" style={{ width: 2, height: 48, borderRadius: 2, backgroundColor: handleActive ? colors.textMuted : 'transparent' }} />
        </Pressable>}
      </View>}
    </View>
    <View style={styles.content}>
      {library && <View style={styles.toolbar}>
        <Pressable dataSet={{ libraryToggle: 'true' }} accessibilityRole="button" accessibilityLabel={pinned ? 'Ocultar índice de biblioteca' : 'Fijar índice de biblioteca'}
          accessibilityState={{ expanded: shown }} onHoverIn={() => { clearTimeout(timer.current); if (!pinned) setPreview(true); }} onHoverOut={leavePreview}
          onPress={() => { closePreview(); setPinned((value) => !value); }} style={({ hovered }) => [styles.smallButton, hovered && { backgroundColor: colors.surfaceHigh }]}>
          <Feather pointerEvents="none" name="sidebar" size={17} color={colors.textMuted} />
        </Pressable>
        <View accessibilityLabel="Ubicación en la biblioteca" style={styles.breadcrumbs}>
          <Pressable accessibilityRole="button" accessibilityLabel="Ir a Biblioteca" onPress={() => open('/biblioteca')} style={styles.crumb}><Text style={styles.trail}>Biblioteca</Text></Pressable>
          {currentFolder && <><Text style={styles.trail}>/</Text><Pressable accessibilityRole="button" accessibilityLabel={`Ir a carpeta ${currentFolder.name}`} onPress={() => open(`/carpetas/${currentFolder.id}`)} style={styles.crumb}><Text numberOfLines={1} style={styles.trail}>{currentFolder.name}</Text></Pressable></>}
          {selectedDeck && <><Text style={styles.trail}>/</Text><Pressable accessibilityRole="button" accessibilityLabel={`Ir a mazo ${selectedDeck.name}`} onPress={() => open(`/mazos/${selectedDeck.id}`)} style={styles.crumb}><Text numberOfLines={1} style={styles.trail}>{selectedDeck.name}</Text></Pressable></>}
        </View>
      </View>}
      <View style={styles.navigator}><DesktopNavigationContext.Provider value={register}>{children}</DesktopNavigationContext.Provider></View>
    </View>
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
  smallButton: { width: 34, height: 34, borderRadius: 5, justifyContent: 'center', alignItems: 'center' },
  search: { flex: 1, minWidth: 0, fontSize: 13, paddingHorizontal: 10, paddingVertical: 10 },
  treeRow: { width: '100%', flexDirection: 'row', alignItems: 'center', minHeight: 46, gap: 10, paddingRight: 16 },
  treeText: { ...font(), color: colors.textMuted, fontSize: 14, lineHeight: 21, flex: 1 },
  count: { ...font(), color: colors.textMuted, fontSize: 12 },
  folderRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 6 },
  chevron: { width: 30, height: 46, justifyContent: 'center', alignItems: 'center' },
  folderName: { flex: 1, flexDirection: 'row', minHeight: 46, alignItems: 'center', gap: 10, paddingRight: 16, borderRadius: 5 },
  emptyFolder: { ...font(), color: colors.textMuted, fontSize: 11, paddingLeft: 38, paddingVertical: 8 },
  error: { ...font(), color: colors.textMuted, fontSize: 12, padding: 16 },
  edgeHandle: { position: 'absolute', right: -6, top: 52, bottom: 0, width: 12, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, minWidth: 0, minHeight: 0 },
  toolbar: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  breadcrumbs: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  crumb: { flexShrink: 1, minWidth: 0, paddingHorizontal: 4, paddingVertical: 8 },
  trail: { ...font(), color: colors.textMuted, fontSize: 13 },
  navigator: { flex: 1, minWidth: 0, minHeight: 0 },
});
