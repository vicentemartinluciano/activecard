import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { toPlainText } from '../lib/richtext';
import { colors, spacing, type } from '../theme';
import ActionSheet from './ActionSheet';
import CardMoveSheet from './CardMoveSheet';
import { Button } from './ui';

export default function CardActions({ card, onClose, onDelete, onMove, onSuspend, onError }) {
  const [deleting, setDeleting] = useState(null);
  const [moving, setMoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const remove = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await onDelete(deleting); setDeleting(null); }
    catch (failure) { setError(failure.message || 'No pudimos eliminar la tarjeta. Tu edición sigue abierta.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <>
    <ActionSheet visible={!!card} title="Tarjeta" onClose={onClose} options={[
      { icon: 'move', label: 'Mover a otro mazo', disabled: card?.id === 'new', onPress: () => setMoving(card) },
      { icon: card?.suspended ? 'play-circle' : 'pause-circle', label: card?.suspended ? 'Reactivar en el estudio' : 'Suspender del estudio', disabled: card?.id === 'new', onPress: () => Promise.resolve(onSuspend(card)).catch((failure) => onError(failure.message || 'No pudimos cambiar el estado de la tarjeta.')) },
      { icon: 'trash-2', label: card?.id === 'new' ? 'Descartar borrador' : 'Eliminar tarjeta', destructive: true, onPress: () => { setError(''); setDeleting(card); } },
    ]} />
    <ActionSheet visible={!!deleting} onClose={() => { if (!busy) setDeleting(null); }} title={deleting?.id === 'new' ? '¿Descartar borrador?' : '¿Eliminar tarjeta?'}>
      <Text numberOfLines={4} style={type.body}>{toPlainText(deleting?.front || '') || 'Tarjeta sin completar'}</Text>
      <Text style={type.small}>{deleting?.id === 'new' ? 'Se descartará este borrador local.' : 'Se eliminarán la tarjeta y su historial de repaso. No se puede deshacer.'}</Text>
      {!!error && <Text accessibilityRole="alert" style={[type.small, { color: colors.danger }]}>{error}</Text>}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}><Button label="Cancelar" kind="ghost" disabled={busy} onPress={() => setDeleting(null)} /><Button label={busy ? 'Eliminando…' : deleting?.id === 'new' ? 'Descartar' : 'Eliminar tarjeta'} kind="danger" disabled={busy} onPress={remove} /></View>
    </ActionSheet>
    <CardMoveSheet visible={!!moving} card={moving} onClose={() => setMoving(null)} onMove={(targetId) => onMove(moving, targetId)} />
  </>;
}
