import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { searchLibrary } from '../lib/search';
import { toPlainText } from '../lib/richtext';
import { colors, font, spacing, type } from '../theme';
import { Button, Card, Chip, Field, Screen } from './ui';

export default function DesktopLibraryHome({ folders, decks, cards, tags, progressByDeck }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [tagIds, setTagIds] = useState([]);
  const [focused, setFocused] = useState(false);
  const foldersById = new Map(folders.map((folder) => [folder.id, folder.name]));
  const visibleDecks = tagIds.length ? decks.filter((deck) => deck.tags?.some((tag) => tagIds.includes(tag.id))) : decks;
  const results = query.trim() ? searchLibrary(query, { folders, decks, cards }) : null;
  return <Screen><ScrollView contentContainerStyle={{ gap: 24, paddingBottom: 40 }}>
    <View style={{ gap: 10 }}>
      <Text style={type.title}>Biblioteca</Text>
      <Text style={type.small}>Elegí un mazo en el índice para editar sus tarjetas o empezar a estudiar.</Text>
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {[[decks.length, 'mazos', 'mazo'], [cards.length, 'tarjetas', 'tarjeta'], [folders.length, 'carpetas', 'carpeta']].map(([value, label, singular]) => <View key={label} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingRight: 12 }}>
        <Text style={{ ...font(700), color: colors.text, fontSize: 20 }}>{value}</Text><Text style={type.small}>{value === 1 ? singular : label}</Text>
      </View>)}
    </View>
    <Field accessibilityLabel="Buscar en toda la biblioteca" placeholder="Buscar carpetas, mazos o texto de una tarjeta" value={query} onChangeText={setQuery} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
    {(focused || tagIds.length > 0) && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{tags.map((tag) => <Chip key={tag.id} label={tag.name} active={tagIds.includes(tag.id)} onPress={() => setTagIds((current) => current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id])} />)}</View>}
    {results ? <View style={{ gap: spacing.sm }}>
      {results.folders.map((item) => <Card key={`f${item.id}`} onPress={() => router.navigate(`/carpetas/${item.id}`)}><Text style={type.body}>Carpeta · {item.name}</Text></Card>)}
      {results.decks.map((item) => <Card key={`d${item.id}`} onPress={() => router.navigate(`/mazos/${item.id}`)}><Text style={type.body}>Mazo · {item.name}</Text></Card>)}
      {results.cards.map((item) => <Card key={`c${item.id}`} onPress={() => router.push(`/mazos/${item.deck_id}/tarjeta?cardId=${item.id}`)}><Text style={type.body}>{toPlainText(item.front)}</Text><Text style={type.small}>{toPlainText(item.back)}</Text></Card>)}
      {!results.folders.length && !results.decks.length && !results.cards.length && <Text style={type.small}>Sin coincidencias.</Text>}
    </View> : <View style={{ gap: 12 }}>
      <Text style={type.label}>MAZOS</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>{visibleDecks.map((deck) => <Card key={deck.id} onPress={() => router.navigate(`/mazos/${deck.id}`)} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0, minHeight: 140, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Feather name={deck.icon || 'layers'} size={22} color={colors.accentText} />
        <Text style={[type.body, font(600), { flex: 1, minWidth: 0 }]}>{deck.name}</Text></View>
        {foldersById.has(deck.folder_id) && <Text style={type.small} numberOfLines={1}>{foldersById.get(deck.folder_id)}</Text>}
        <Text style={[type.small, { fontSize: 14 }]}>{deck.card_count} {deck.card_count === 1 ? 'tarjeta' : 'tarjetas'} · {progressByDeck[deck.id]?.pct || 0}% repasado hoy</Text>
      </Card>)}</View>
      {!decks.length && <Button label="Crear tu primer mazo" kind="primary" onPress={() => router.navigate('/crear')} />}
    </View>}
  </ScrollView></Screen>;
}
