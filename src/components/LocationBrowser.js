import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { folderPath } from '../lib/folderTree';
import { locationLabel } from '../lib/libraryLocation';
import { normalizeSearch } from '../lib/search';
import { colors, spacing, type } from '../theme';
import { EmptyState, Field } from './ui';

// Recorrer una ubicación solo cambia la propuesta local; confirma el consumidor.
export default function LocationBrowser({ folders, value = null, onChange, disabled = false, allowed = () => true, decks, selectedDeckId = null, onSelectDeck }) {
  const [query, setQuery] = useState('');
  const searching = !!query.trim();
  const matches = (text) => normalizeSearch(text).includes(normalizeSearch(query.trim()));
  const shownFolders = folders.filter((folder) => allowed(folder.id) && (searching ? matches(locationLabel(folders, folder.id)) : (folder.parent_id ?? null) === value));
  const shownDecks = (decks || []).filter((deck) => searching ? matches(`${deck.name} ${locationLabel(folders, deck.folder_id)}`) : (deck.folder_id ?? null) === value);
  const enter = (id) => { if (!disabled) { setQuery(''); onChange(id); } };
  return <View style={{ gap: spacing.sm }}>
    <Text style={type.label}>Destino</Text>
    <View accessibilityLabel="Carpeta de destino" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
      {[{ id: null, name: 'Biblioteca' }, ...folderPath(folders, value)].map((part, index) => <View key={part.id ?? 'root'} style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
        {index > 0 && <Text style={type.small}> / </Text>}
        <Pressable accessibilityRole="button" accessibilityLabel={`Elegir ubicación ${part.name}`} disabled={disabled} onPress={() => enter(part.id)} style={{ minHeight: 44, paddingHorizontal: 5, justifyContent: 'center', flexShrink: 1 }}><Text style={[type.small, { color: colors.accentText }]}>{part.name}</Text></Pressable>
      </View>)}
    </View>
    <Field accessibilityLabel="Buscar destino" placeholder={decks ? 'Buscar carpetas o mazos…' : 'Buscar carpeta…'} value={query} onChangeText={setQuery} editable={!disabled} />
    <ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 4 }}>
      {shownFolders.map((folder) => <Pressable key={`folder-${folder.id}`} accessibilityRole="button" accessibilityLabel={`Abrir destino ${locationLabel(folders, folder.id)}`} disabled={disabled} onPress={() => enter(folder.id)} style={{ minHeight: 52, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Feather name="folder" size={20} color={colors.textMuted} /><View style={{ flex: 1, minWidth: 0 }}><Text style={type.body}>{folder.name}</Text>{searching && <Text style={type.small}>{locationLabel(folders, folder.parent_id)}</Text>}</View><Feather name="chevron-right" size={18} color={colors.textMuted} />
      </Pressable>)}
      {shownDecks.map((deck) => <Pressable key={`deck-${deck.id}`} accessibilityRole="button" accessibilityLabel={`Elegir mazo ${deck.name} en ${locationLabel(folders, deck.folder_id)}`} accessibilityState={{ selected: selectedDeckId === deck.id }} disabled={disabled} onPress={() => onSelectDeck?.(deck.id)} style={{ minHeight: 52, padding: spacing.sm, borderRadius: 10, backgroundColor: selectedDeckId === deck.id ? colors.accentSoft : 'transparent', flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Feather name="layers" size={20} color={colors.textMuted} /><View style={{ flex: 1, minWidth: 0 }}><Text style={type.body}>{deck.name}</Text>{searching && <Text style={type.small}>{locationLabel(folders, deck.folder_id)}</Text>}</View>{selectedDeckId === deck.id && <Feather name="check" size={18} color={colors.accentText} />}
      </Pressable>)}
      {!shownFolders.length && !shownDecks.length && <EmptyState text={searching ? 'No hay destinos con ese nombre.' : decks ? 'No hay otros mazos en esta ubicación.' : 'No hay subcarpetas. Podés usar esta ubicación.'} />}
    </ScrollView>
  </View>;
}
