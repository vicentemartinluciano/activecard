import { useState } from 'react';
import { Text, View } from 'react-native';
import { locationLabel } from '../lib/libraryLocation';
import { spacing, type } from '../theme';
import LocationBrowser from './LocationBrowser';
import { Button } from './ui';

export default function DeckPicker({ decks, folders, value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [candidate, setCandidate] = useState(value);
  const [folderId, setFolderId] = useState(null);
  const selected = decks.find((deck) => deck.id === value);
  return <View style={{ gap: spacing.sm }}>
    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}><Text style={[type.body, { flex: 1 }]}>{selected ? `${locationLabel(folders, selected.folder_id)} / ${selected.name}` : 'Elegí un mazo de destino'}</Text><Button label="Cambiar mazo" kind="ghost" disabled={disabled} onPress={() => { setCandidate(value); setFolderId(selected?.folder_id ?? null); setOpen(true); }} /></View>
    {open && <>
      <LocationBrowser folders={folders} decks={decks} value={folderId} onChange={(id) => { setFolderId(id); setCandidate(null); }} selectedDeckId={candidate} onSelectDeck={setCandidate} disabled={disabled} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}><Button label="Cancelar cambio" disabled={disabled} onPress={() => setOpen(false)} /><Button label="Usar este mazo" kind="primary" disabled={disabled || !decks.some((deck) => deck.id === candidate)} onPress={() => { onChange(candidate); setOpen(false); }} /></View>
    </>}
  </View>;
}
