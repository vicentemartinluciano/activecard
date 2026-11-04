import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, Text, View } from 'react-native';
import { libraryContents, locationLabel } from '../lib/libraryLocation';
import { toPlainText } from '../lib/richtext';
import { colors, spacing, type } from '../theme';
import ActionSheet from './ActionSheet';
import CreationSheet from './CreationSheet';
import DeckListItem from './DeckListItem';
import DeckMoveSheet from './DeckMoveSheet';
import Toast from './Toast';
import FolderActions from './FolderActions';
import LibraryBreadcrumbs from './LibraryBreadcrumbs';
import { Button, Card, Chip, EmptyState, Field } from './ui';

// Misma estructura de navegación para Android, web angosta y escritorio.
export default function LibraryContent({ folders, decks, cards = [], tags = [], progressByDeck = {}, folderId = null, onRefresh }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);
  const [tagIds, setTagIds] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuFolder, setMenuFolder] = useState(null);
  const params = useLocalSearchParams();
  const [creation, setCreation] = useState(null);
  const [move, setMove] = useState(null);
  const [menuDeck, setMenuDeck] = useState(null);
  const [moved, setMoved] = useState(null);
  useEffect(() => {
    if (params.create) { setCreation(['mazo', 'carpeta'].includes(params.create) ? params.create : 'choose'); router.setParams({ create: undefined }); }
  }, [params.create, router]);
  const folder = folders.find((f) => f.id === folderId);
  const searching = !!query.trim();
  const result = libraryContents({ folders, decks, cards, folderId, all, query, tagIds });
  const rows = [
    ...(result.folders.length ? [{ key: 'folders-label', label: folderId == null ? 'Carpetas' : 'Subcarpetas' }] : []),
    ...result.folders.map((item) => ({ key: `folder-${item.id}`, kind: 'folder', item })),
    { key: 'decks-label', label: all || tagIds.length ? 'Todos los mazos' : searching ? 'Mazos encontrados' : folderId == null ? 'Mazos sueltos' : 'Mazos' },
    ...result.decks.map((item) => ({ key: `deck-${item.id}`, kind: 'deck', item })),
    ...(result.cards.length ? [{ key: 'cards-label', label: 'Tarjetas encontradas' }] : []),
    ...result.cards.map((item) => ({ key: `card-${item.id}`, kind: 'card', item })),
  ];
  const empty = !result.folders.length && !result.decks.length && !result.cards.length;
  const directDecks = decks.filter((d) => (d.folder_id ?? null) === folderId).length;
  const children = folders.filter((f) => (f.parent_id ?? null) === folderId).length;
  const title = folder?.name || 'Biblioteca';
  return <>
    <FlatList data={rows} keyExtractor={(row) => row.key} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
      ListHeaderComponent={<View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
        {folderId != null && <LibraryBreadcrumbs folders={folders} folderId={folderId} onNavigate={(route) => router.dismissTo(route)} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ flex: 1, minWidth: 0 }}><Text style={type.title}>{title}</Text>
            <Text style={type.small}>{directDecks} {directDecks === 1 ? 'mazo directo' : 'mazos directos'} · {children} {children === 1 ? 'carpeta' : 'carpetas'}</Text></View>
          <Button label="Nuevo" kind="primary" onPress={() => setCreation('choose')} />
          {folder && <Pressable accessibilityRole="button" accessibilityLabel="Opciones de la carpeta" onPress={() => setMenuFolder(folder)} style={{ padding: 12 }}><Feather name="more-horizontal" size={22} color={colors.textMuted} /></Pressable>}
        </View>
        <Field accessibilityLabel={folderId == null ? 'Buscar en toda la biblioteca' : 'Buscar en esta carpeta y sus subcarpetas'} placeholder={folderId == null ? 'Buscar carpetas, mazos o tarjetas…' : 'Buscar en esta carpeta…'} value={query} onChangeText={setQuery} />
        {!!query && <Button label="Limpiar búsqueda" kind="ghost" onPress={() => setQuery('')} />}
        <Button label={`Filtros${tagIds.length + Number(all) ? ` (${tagIds.length + Number(all)})` : ''}`} kind="ghost" onPress={() => setFiltersOpen((open) => !open)} />
        {(filtersOpen || tagIds.length > 0 || all) && <>
        {folderId == null && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Chip label="En esta ubicación" active={!all && !tagIds.length} onPress={() => { setAll(false); setTagIds([]); }} />
          <Chip label="Todos los mazos" active={all || !!tagIds.length} onPress={() => setAll(true)} />
        </View>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {tags.map((tag) => <Chip key={tag.id} label={tag.name} active={tagIds.includes(tag.id)} onPress={() => setTagIds((ids) => ids.includes(tag.id) ? ids.filter((id) => id !== tag.id) : [...ids, tag.id])} />)}
          {(tagIds.length > 0 || all) && <Button label="Quitar filtros" kind="ghost" onPress={() => { setTagIds([]); setAll(false); }} />}
        </View></>}
      </View>}
      renderItem={({ item: row }) => {
        if (row.label) return <Text style={[type.label, { marginTop: spacing.md }]}>{row.label}</Text>;
        const item = row.item;
        if (row.kind === 'folder') return <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}><Card onPress={() => router.navigate(`/carpetas/${item.id}`)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Feather name="folder" size={22} color={colors.accentText} /><View style={{ flex: 1, minWidth: 0 }}><Text style={type.body}>{item.name}</Text><Text style={type.small}>{searching ? locationLabel(folders, item.parent_id) : `${item.deck_count ?? 0} ${item.deck_count === 1 ? 'mazo directo' : 'mazos directos'}`}</Text></View><Feather name="chevron-right" size={18} color={colors.textMuted} />
        </Card><Pressable accessibilityRole="button" accessibilityLabel={`Opciones de la carpeta ${item.name}`} onPress={() => setMenuFolder(item)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Feather name="more-horizontal" size={20} color={colors.textMuted} /></Pressable></View>;
        if (row.kind === 'deck') return <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}><View style={{ flex: 1, minWidth: 0 }}><DeckListItem deck={item} progress={progressByDeck[item.id]} onPress={() => router.navigate(`/mazos/${item.id}`)} /></View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Opciones del mazo ${item.name}`} onPress={() => setMenuDeck(item)} style={{ padding: 12 }}><Feather name="more-horizontal" size={20} color={colors.textMuted} /></Pressable></View>
          {(searching || all || tagIds.length > 0) && <Text style={[type.small, { paddingHorizontal: spacing.sm }]}>{locationLabel(folders, item.folder_id)}</Text>}
        </View>;
        const parent = decks.find((d) => d.id === item.deck_id);
        return <Card onPress={() => router.push(`/mazos/${item.deck_id}/tarjeta?cardId=${item.id}`)} style={{ gap: 4 }}><Text style={type.body} numberOfLines={2}>{toPlainText(item.front)}</Text><Text style={type.small} numberOfLines={2}>{toPlainText(item.back)}</Text><Text style={type.small}>{locationLabel(folders, parent?.folder_id)} / {parent?.name}</Text></Card>;
      }}
      ListFooterComponent={empty ? <View style={{ gap: spacing.sm }}><EmptyState icon={searching || tagIds.length ? 'search' : 'folder'} text={searching || tagIds.length ? 'No hay resultados con esta búsqueda y estos filtros.' : 'Todavía no hay contenido en esta ubicación.'} />{!searching && !tagIds.length && <Button label="Crear tu primer mazo acá" kind="primary" onPress={() => setCreation('choose')} />}</View> : null}
      showsVerticalScrollIndicator={Platform.OS === 'web'} />
    <FolderActions folder={menuFolder} folders={folders} onClose={() => setMenuFolder(null)} onChanged={onRefresh} onDeleted={async (deleted) => { if (deleted.id === folderId) router.replace(deleted.parent_id == null ? '/biblioteca' : `/carpetas/${deleted.parent_id}`); }} />
    <CreationSheet kind={creation} folderId={folderId} onClose={() => setCreation(null)} />
    <DeckMoveSheet visible={!!move} deckId={move?.deckId} targetFolderId={move?.targetFolderId ?? null} onClose={() => setMove(null)} onMoved={async (result) => { setMoved(result); await onRefresh?.(); }} />
    <Toast message={moved ? `Mazo movido a ${locationLabel(folders, moved.targetFolderId)}` : ''} tone="success" onDismiss={() => setMoved(null)} onAction={moved ? () => { const route = moved.targetFolderId == null ? '/biblioteca' : `/carpetas/${moved.targetFolderId}`; setMoved(null); router.navigate(route); } : undefined} />
    <ActionSheet visible={!!menuDeck} title={menuDeck?.name} onClose={() => setMenuDeck(null)} options={menuDeck ? [
      { label: 'Mover mazo', icon: 'folder', onPress: () => setMove({ deckId: menuDeck.id, targetFolderId: menuDeck.folder_id ?? null }) },

    ] : []} />
  </>;
}
