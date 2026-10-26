import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Platform, Pressable, Text, View } from 'react-native';
import { libraryContents, locationLabel } from '../lib/libraryLocation';
import { toPlainText } from '../lib/richtext';
import { colors, spacing, type } from '../theme';
import ActionSheet from './ActionSheet';
import CreationSheet from './CreationSheet';
import DeckListItem from './DeckListItem';
import DeckMoveSheet from './DeckMoveSheet';
import LibraryBreadcrumbs from './LibraryBreadcrumbs';
import { Button, Card, Chip, EmptyState, Field } from './ui';

// Misma estructura de navegación para Android, web angosta y escritorio.
export default function LibraryContent({ folders, decks, cards = [], tags = [], progressByDeck = {}, folderId = null, onRefresh, onFolderOptions, hasIdeas = false }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);
  const [tagIds, setTagIds] = useState([]);
  const [focused, setFocused] = useState(false);
  const [creation, setCreation] = useState(null);
  const [move, setMove] = useState(null);
  const [menuDeck, setMenuDeck] = useState(null);
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
        {folderId != null && <LibraryBreadcrumbs folders={folders} folderId={folderId} onNavigate={(route) => router.navigate(route)} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ flex: 1, minWidth: 0 }}><Text style={type.title}>{title}</Text>
            <Text style={type.small}>{directDecks} {directDecks === 1 ? 'mazo directo' : 'mazos directos'} · {children} {children === 1 ? 'carpeta' : 'carpetas'}</Text></View>
          {onFolderOptions && <Pressable accessibilityRole="button" accessibilityLabel="Opciones de la carpeta" onPress={onFolderOptions} style={{ padding: 12 }}><Feather name="more-horizontal" size={22} color={colors.textMuted} /></Pressable>}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Button label="Nuevo mazo" kind="primary" onPress={() => setCreation('choose')} />
          <Button label={folderId == null ? 'Nueva carpeta' : 'Nueva subcarpeta'} onPress={() => setCreation('carpeta')} />
          <Button label="Mover mazo existente" onPress={() => setMove({ deckId: null, targetFolderId: folderId })} />
        </View>
        {folderId == null && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Chip label="En esta ubicación" active={!all && !tagIds.length} onPress={() => { setAll(false); setTagIds([]); }} />
          <Chip label="Todos los mazos" active={all || !!tagIds.length} onPress={() => setAll(true)} />
        </View>}
        <Field accessibilityLabel={folderId == null ? 'Buscar en toda la biblioteca' : 'Buscar en esta carpeta y sus subcarpetas'} placeholder={folderId == null ? 'Buscar carpetas, mazos o tarjetas…' : 'Buscar en esta carpeta…'} value={query} onChangeText={setQuery} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
        {!!query && <Button label="Limpiar búsqueda" kind="ghost" onPress={() => setQuery('')} />}
        {tags.length > 0 && (focused || tagIds.length > 0) && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {tags.map((tag) => <Chip key={tag.id} label={tag.name} active={tagIds.includes(tag.id)} onPress={() => setTagIds((ids) => ids.includes(tag.id) ? ids.filter((id) => id !== tag.id) : [...ids, tag.id])} />)}
          {!!tagIds.length && <Button label="Quitar filtros" kind="ghost" onPress={() => setTagIds([])} />}
        </View>}
        {folderId == null && hasIdeas && !searching && !tagIds.length && <Card onPress={() => router.navigate('/gimnasio')}><Text style={type.body}>Gimnasio Mental</Text><Text style={type.small}>Tus ideas y conversaciones</Text></Card>}
      </View>}
      renderItem={({ item: row }) => {
        if (row.label) return <Text style={[type.label, { marginTop: spacing.md }]}>{row.label}</Text>;
        const item = row.item;
        if (row.kind === 'folder') return <Card onPress={() => router.navigate(`/carpetas/${item.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Feather name="folder" size={22} color={colors.accentText} /><View style={{ flex: 1, minWidth: 0 }}><Text style={type.body}>{item.name}</Text><Text style={type.small}>{searching ? locationLabel(folders, item.parent_id) : `${item.deck_count ?? 0} mazos directos`}</Text></View><Feather name="chevron-right" size={18} color={colors.textMuted} />
        </Card>;
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
    <CreationSheet kind={creation} folderId={folderId} onClose={() => setCreation(null)} />
    <DeckMoveSheet visible={!!move} deckId={move?.deckId} targetFolderId={move?.targetFolderId ?? null} onClose={() => setMove(null)} onMoved={onRefresh} />
    <ActionSheet visible={!!menuDeck} title={menuDeck?.name} onClose={() => setMenuDeck(null)} options={menuDeck ? [
      { label: 'Mover mazo', icon: 'folder', onPress: () => setMove({ deckId: menuDeck.id, targetFolderId: menuDeck.folder_id ?? null }) },
      ...(menuDeck.folder_id != null ? [{ label: 'Sacar de esta carpeta', icon: 'folder-minus', onPress: () => setMove({ deckId: menuDeck.id, targetFolderId: null }) }] : []),
    ] : []} />
  </>;
}
