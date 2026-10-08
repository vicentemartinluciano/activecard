import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

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

function RailButton({ label, icon, active, onPress, pending = false }) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  return <View style={styles.railItem}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }}
      accessibilityHint={pending ? 'Hay cambios de otro dispositivo para incorporar en Ajustes' : undefined}
      onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [styles.railButton, { backgroundColor: hovered || pressed ? colors.surfaceHigh : 'transparent', borderBottomColor: focused ? colors.accentText : 'transparent' }]}>
      <Feather pointerEvents="none" name={icon} size={20} color={active ? colors.accentText : colors.textMuted} />
      {pending && <View pointerEvents="none" style={{ position: 'absolute', right: 6, top: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accentText }} />}
    </Pressable>
    {(hovered || focused) && <View pointerEvents="none" style={styles.tooltip}><Text style={styles.tooltipText}>{pending ? `${label} · incorporar cambios` : label}</Text></View>}
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
  const selectedFolder = decks.find((deck) => deck.id === selectedId)?.folder_id;
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
    onPress={() => open(`/mazos/${deck.id}`)} style={({ hovered }) => [styles.treeRow, { paddingLeft: child ? 38 : 14, backgroundColor: hovered || selectedId === deck.id ? colors.surfaceHigh : 'transparent' }]}>
    <Feather pointerEvents="none" name="layers" size={15} color={selectedId === deck.id ? colors.accentText : colors.textMuted} />
    <Text numberOfLines={1} style={[styles.treeText, selectedId === deck.id && { color: colors.text }]}>{deck.name}</Text>
    <Text style={styles.count}>{deck.card_count}</Text>
  </Pressable>;
  return <View style={styles.shell}>
    <View style={styles.rail}>
      <Image accessibilityLabel="ActiveCard" source={require('../../assets/images/splash-icon.png')} resizeMode="contain" style={styles.brand} />
      <View style={styles.sections}>{sections.map(([key, label, icon, route]) => <RailButton key={key} label={label} icon={icon} active={section === key} onPress={() => open(route)} />)}</View>
      <RailButton label="Ajustes" icon="settings" active={section === 'ajustes'} pending={syncStatus?.pending} onPress={() => open('/ajustes')} />
    </View>
    <View style={{ width: library && pinned && !narrow ? DESKTOP_INDEX_WIDTH : 0, zIndex: 30 }}>
      {library && <View dataSet={{ libraryIndex: 'true' }} testID="desktop-library-index"
        onPointerEnter={() => { clearTimeout(timer.current); refresh(); }} onPointerLeave={leavePreview}
        // display:none removes hidden links from keyboard navigation; the navigator below stays mounted.
        style={[styles.index, { display: shown ? 'flex' : 'none', top: floating ? 48 : 0, bottom: floating ? 12 : 0 }, floating && styles.floating]}>
        <View style={styles.indexHeading}><Text style={styles.indexTitle}>Biblioteca</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Crear contenido" onPress={() => open('/crear')} style={styles.smallButton}><Feather name="plus" size={17} color={colors.textMuted} /></Pressable>
        </View>
        <Field accessibilityLabel="Buscar carpetas y mazos" value={query} onChangeText={setQuery} placeholder="Buscar en el índice" style={styles.search} />
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          {error ? <Pressable accessibilityRole="button" onPress={refresh}><Text style={styles.error}>{error} Reintentar</Text></Pressable> : null}
          {tree.folders.map((folder) => {
            const isOpen = !!query.trim() || !!expanded[folder.id];
            return <View key={folder.id}>
              <View style={styles.folderRow}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${isOpen ? 'Plegar' : 'Desplegar'} carpeta ${folder.name}`} accessibilityState={{ expanded: isOpen }}
                  onPress={() => setExpanded((value) => ({ ...value, [folder.id]: !value[folder.id] }))} style={styles.chevron}>
                  <Feather pointerEvents="none" name={isOpen ? 'chevron-down' : 'chevron-right'} size={14} color={colors.textMuted} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Abrir carpeta ${folder.name}`} title={folder.name} onPress={() => open(`/carpetas/${folder.id}`)}
                  style={({ hovered }) => [styles.folderName, hovered && { backgroundColor: colors.surfaceHigh }]}>
                  <Feather pointerEvents="none" name="folder" size={15} color={colors.textMuted} /><Text numberOfLines={1} style={styles.treeText}>{folder.name}</Text>
                </Pressable>
              </View>
              {isOpen && (folder.children.length ? folder.children.map((deck) => deckRow(deck, true)) : <Text style={styles.emptyFolder}>Sin mazos</Text>)}
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
        <Text numberOfLines={1} style={styles.trail}>{selectedFolder ? `${folders.find((folder) => folder.id === selectedFolder)?.name || 'Biblioteca'} / ` : ''}{decks.find((deck) => deck.id === selectedId)?.name || 'Biblioteca'}</Text>
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
  rail: { width: DESKTOP_RAIL_WIDTH, alignItems: 'center', paddingVertical: 18, borderRightWidth: 1, borderRightColor: colors.border, zIndex: 50 },
  brand: { width: 38, height: 38 },
  sections: { flex: 1, justifyContent: 'center', gap: 14 },
  railItem: { position: 'relative' },
  railButton: { width: 38, height: 38, borderRadius: 8, borderBottomWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tooltip: { position: 'absolute', left: 47, top: 7, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 5, backgroundColor: colors.surfaceHigh },
  tooltipText: { ...font(600), color: colors.text, fontSize: 12, whiteSpace: 'nowrap' },
  index: { position: 'absolute', left: 0, width: DESKTOP_INDEX_WIDTH, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border },
  floating: { borderRadius: 10, boxShadow: '8px 0 24px rgba(0,0,0,0.3)' },
  indexHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 8, height: 52 },
  indexTitle: { ...font(600), color: colors.text, fontSize: 13 },
  smallButton: { width: 34, height: 34, borderRadius: 5, justifyContent: 'center', alignItems: 'center' },
  search: { marginHorizontal: 12, marginBottom: 14, fontSize: 12, paddingHorizontal: 10, paddingVertical: 8 },
  treeRow: { flexDirection: 'row', alignItems: 'center', minHeight: 36, gap: 8, paddingRight: 14 },
  treeText: { ...font(), color: colors.textMuted, fontSize: 12, flex: 1 },
  count: { ...font(), color: colors.textMuted, fontSize: 10 },
  folderRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 6 },
  chevron: { width: 26, height: 36, justifyContent: 'center', alignItems: 'center' },
  folderName: { flex: 1, flexDirection: 'row', minHeight: 36, alignItems: 'center', gap: 8, paddingRight: 14, borderRadius: 5 },
  emptyFolder: { ...font(), color: colors.textMuted, fontSize: 11, paddingLeft: 38, paddingVertical: 8 },
  error: { ...font(), color: colors.textMuted, fontSize: 12, padding: 16 },
  edgeHandle: { position: 'absolute', right: -6, top: 52, bottom: 0, width: 12, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, minWidth: 0, minHeight: 0 },
  toolbar: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  trail: { ...font(), color: colors.textMuted, fontSize: 12, flex: 1 },
  navigator: { flex: 1, minWidth: 0, minHeight: 0 },
});
