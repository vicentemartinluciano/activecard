import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { listDecks } from '../db/decks';
import { listFolders } from '../db/folders';
import { locationLabel } from '../lib/libraryLocation';
import { colors, spacing, type } from '../theme';
import ActionSheet from './ActionSheet';
import LocationBrowser from './LocationBrowser';
import { Button } from './ui';

export default function CardMoveSheet({ visible, card, onClose, onMove }) {
  const [data, setData] = useState(null);
  const [folderId, setFolderId] = useState(null);
  const [targetId, setTargetId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setData(null); setError(''); setTargetId(null);
    Promise.all([listDecks(), listFolders()]).then(([decks, folders]) => {
      if (!alive) return;
      setData({ decks, folders });
      setFolderId(decks.find((deck) => deck.id === card?.deck_id)?.folder_id ?? null);
    }).catch(() => { if (alive) setError('No pudimos cargar los destinos. Cerrá y volvé a intentar.'); });
    return () => { alive = false; };
  }, [visible, card?.deck_id]);
  const origin = data?.decks.find((deck) => deck.id === card?.deck_id);
  const target = data?.decks.find((deck) => deck.id === targetId);
  const path = (deck) => `${locationLabel(data.folders, deck.folder_id)} / ${deck.name}`;
  const submit = async () => {
    if (!target || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await onMove(target.id); onClose(); }
    catch (failure) { setError(failure.message || 'No pudimos mover la tarjeta.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <ActionSheet visible={visible} onClose={() => { if (!busy) onClose(); }} title="Mover tarjeta">
    {origin && <Text style={type.small}>Desde {path(origin)}</Text>}
    {!data && !error && <Text style={type.small}>Cargando destinos…</Text>}
    {data && <LocationBrowser folders={data.folders} value={folderId} onChange={(id) => { setFolderId(id); setTargetId(null); }} disabled={busy} decks={data.decks.filter((deck) => deck.id !== card?.deck_id)} selectedDeckId={targetId} onSelectDeck={setTargetId} />}
    {target && <Text style={type.small}>Se moverá a {path(target)}</Text>}
    {!!error && <Text accessibilityRole="alert" style={[type.small, { color: colors.danger }]}>{error}</Text>}
    <View style={{ flexDirection: 'row', gap: spacing.sm }}><Button label="Cancelar" kind="ghost" disabled={busy} onPress={onClose} /><Button label={busy ? 'Moviendo…' : 'Mover tarjeta'} kind="primary" disabled={!target || busy} onPress={submit} /></View>
  </ActionSheet>;
}
