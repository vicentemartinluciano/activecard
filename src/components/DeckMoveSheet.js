import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { listDecks, setDeckFolder } from '../db/decks';
import { listFolders } from '../db/folders';
import { locationLabel } from '../lib/libraryLocation';
import { normalizeSearch } from '../lib/search';
import { colors, spacing, type } from '../theme';
import ActionSheet from './ActionSheet';
import FolderPicker from './FolderPicker';
import { Button, Card, Field } from './ui';

// Sin deckId permite traer un mazo desde cualquier carpeta a la ubicación actual.
export default function DeckMoveSheet({ visible, deckId = null, targetFolderId = null, onClose, onMoved }) {
  const [decks, setDecks] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selected, setSelected] = useState(deckId);
  const [destination, setDestination] = useState(targetFolderId);
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setSelected(deckId); setDestination(targetFolderId); setQuery(''); setError(''); setLoaded(false);
    Promise.all([listDecks(), listFolders()]).then(([d, f]) => { if (alive) { setDecks(d); setFolders(f); setLoaded(true); } }).catch(() => { if (alive) setError('No pudimos cargar los mazos. Cerrá y volvé a intentar.'); });
    return () => { alive = false; };
  }, [visible, deckId, targetFolderId]);
  const deck = decks.find((d) => d.id === selected);
  const move = async () => {
    if (lock.current || !deck) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await setDeckFolder(deck.id, destination);
      await onMoved?.(); onClose();
    } catch (e) {
      setError(e.message || 'No pudimos mover el mazo.');
      try { setFolders(await listFolders()); } catch { /* Conservar el error de la operación. */ }
    } finally { lock.current = false; setBusy(false); }
  };
  return <ActionSheet visible={visible} title="Mover mazo" onClose={() => { if (!lock.current) onClose(); }}>
    <ScrollView style={{ maxHeight: 500, flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md }}>
      {!loaded && !error && <Text style={type.small}>Cargando mazos…</Text>}
      {loaded && <>
        {!deckId && <>
          <Field accessibilityLabel="Buscar mazo para mover" placeholder="Buscar por nombre o ubicación…" value={query} onChangeText={setQuery} editable={!busy} />
          <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm }}>
            {decks.filter((d) => d.folder_id !== targetFolderId && normalizeSearch(`${d.name} ${locationLabel(folders, d.folder_id)}`).includes(normalizeSearch(query.trim()))).map((d) => <Card key={d.id} onPress={() => { if (!busy) setSelected(d.id); }} style={{ gap: 4, borderColor: selected === d.id ? colors.accentText : colors.cardBorder }}>
              <Text style={type.body}>{d.name}{selected === d.id ? ' · Seleccionado' : ''}</Text>
              <Text style={type.small}>{locationLabel(folders, d.folder_id)}</Text>
            </Card>)}
            {!decks.some((d) => d.folder_id !== targetFolderId && normalizeSearch(`${d.name} ${locationLabel(folders, d.folder_id)}`).includes(normalizeSearch(query.trim()))) && <Text style={type.small}>No hay mazos para mover que coincidan.</Text>}
          </ScrollView>
        </>}
        {deck && <View style={{ gap: 4 }}><Text style={type.body}>{deck.name}</Text><Text style={type.small}>Desde: {locationLabel(folders, deck.folder_id)}</Text></View>}
        <FolderPicker folders={folders} value={destination} onChange={setDestination} disabled={busy} label="Mover a" />
        <Button label={busy ? 'Moviendo…' : 'Confirmar movimiento'} kind="primary" disabled={busy || !deck || (deck.folder_id ?? null) === destination} onPress={move} />
      </>}
      {!!error && <Text accessibilityRole="alert" style={[type.small, { color: colors.danger }]}>{error}</Text>}
      <Button label="Cancelar" disabled={busy} onPress={onClose} />
    </ScrollView>
  </ActionSheet>;
}
