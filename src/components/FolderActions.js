import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { deleteFolder, moveFolder, renameFolder } from '../db/folders';
import { canMoveFolder } from '../lib/folderTree';
import { locationLabel } from '../lib/libraryLocation';
import { colors, spacing, type } from '../theme';
import ActionSheet from './ActionSheet';
import ConfirmDeleteSheet from './ConfirmDeleteSheet';
import LocationBrowser from './LocationBrowser';
import { Button, Field } from './ui';

export default function FolderActions({ folder, folders, onClose, onChanged, onDeleted }) {
  const [target, setTarget] = useState(null);
  const [mode, setMode] = useState(null);
  const [name, setName] = useState('');
  const [destination, setDestination] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const open = (next) => { setTarget(folder); setName(folder.name); setDestination(folder.parent_id ?? null); setError(''); setMode(next); };
  const submit = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (mode === 'rename') await renameFolder(target.id, name);
      else await moveFolder(target.id, destination);
      setMode(null); await onChanged?.();
    } catch (failure) { setError(failure.message || 'No pudimos guardar el cambio.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const valid = target && canMoveFolder(folders, target.id, destination) && (target.parent_id ?? null) !== destination;
  return <>
    <ActionSheet visible={!!folder} title={folder?.name} onClose={onClose} options={[
      { icon: 'edit-2', label: 'Renombrar carpeta', onPress: () => open('rename') },
      { icon: 'folder', label: 'Mover carpeta', onPress: () => open('move') },
      { icon: 'trash-2', label: 'Borrar carpeta', destructive: true, onPress: () => open('delete') },
    ]} />
    <ActionSheet visible={mode === 'rename' || mode === 'move'} title={mode === 'rename' ? 'Renombrar carpeta' : 'Mover carpeta'} onClose={() => { if (!busy) setMode(null); }}>
      {mode === 'rename' ? <Field accessibilityLabel="Nombre de la carpeta" value={name} onChangeText={setName} editable={!busy} /> : <>
        <Text style={type.body}>{target?.name}</Text><Text style={type.small}>Desde {locationLabel(folders, target?.parent_id)}</Text>
        <LocationBrowser folders={folders} value={destination} onChange={setDestination} disabled={busy} allowed={(id) => canMoveFolder(folders, target?.id, id)} />
        <Text style={type.small}>Se moverá a {locationLabel(folders, destination)}</Text>
      </>}
      {!!error && <Text accessibilityRole="alert" style={[type.small, { color: colors.danger }]}>{error}</Text>}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}><Button label="Cancelar" kind="ghost" disabled={busy} onPress={() => setMode(null)} /><Button label={busy ? 'Guardando…' : mode === 'rename' ? 'Guardar nombre' : 'Mover aquí'} kind="primary" disabled={busy || (mode === 'rename' ? !name.trim() : !valid)} onPress={submit} /></View>
    </ActionSheet>
    <ConfirmDeleteSheet visible={mode === 'delete'} name={target?.name || ''} description="Los mazos quedan sueltos y las subcarpetas suben al nivel anterior." onClose={() => setMode(null)} onConfirm={async () => { await deleteFolder(target.id); await onDeleted?.(target); await onChanged?.(); }} />
  </>;
}
