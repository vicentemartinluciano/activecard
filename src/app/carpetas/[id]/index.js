import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import ActionSheet from '../../../components/ActionSheet';
import ConfirmDeleteSheet from '../../../components/ConfirmDeleteSheet';
import FolderPicker from '../../../components/FolderPicker';
import LibraryContent from '../../../components/LibraryContent';
import Toast from '../../../components/Toast';
import { Button, Field, Screen } from '../../../components/ui';
import { listAllCardsForSearch } from '../../../db/cards';
import { listDecks, listTags } from '../../../db/decks';
import { deleteFolder, getFolder, listFolders, moveFolder, renameFolder } from '../../../db/folders';
import { getDecksDailyProgress } from '../../../db/progress';
import { canMoveFolder } from '../../../lib/folderTree';
import { colors, spacing, type } from '../../../theme';

export default function DetalleCarpeta() {
  const { id } = useLocalSearchParams();
  const folderId = Number(id);
  const router = useRouter();
  const [data, setData] = useState(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState('');
  const [destination, setDestination] = useState(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const request = useRef(0);
  const load = useCallback(async () => {
    const ticket = ++request.current;
    try {
      const [folder, folders, decks, cards, tags, progressByDeck] = await Promise.all([getFolder(folderId), listFolders(), listDecks(), listAllCardsForSearch(), listTags(), getDecksDailyProgress()]);
      if (ticket !== request.current) return;
      setMissing(!folder); setData(folder ? { folder, folders, decks, cards, tags, progressByDeck } : null); setError('');
    } catch (e) { if (ticket === request.current) setError(e.message || 'No pudimos cargar esta carpeta.'); }
  }, [folderId]);
  useFocusEffect(useCallback(() => { load(); return () => { request.current++; }; }, [load]));
  const currentData = data?.folder.id === folderId ? data : null;
  const run = async (operation) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await operation(); } catch (e) { setError(e.message || 'No pudimos guardar el cambio.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Screen>
    <Stack.Screen options={{ title: currentData?.folder.name || 'Carpeta', headerShown: Platform.OS !== 'web' }} />
    {currentData && !missing ? <LibraryContent key={folderId} {...currentData} folderId={folderId} onRefresh={load} onFolderOptions={() => setOptions(true)} /> : <View style={{ gap: spacing.md }}>
      <Text style={type.body}>{missing ? 'Esta carpeta ya no está disponible.' : error || 'Cargando carpeta…'}</Text>
      {missing ? <Button label="Ir a Biblioteca" onPress={() => router.replace('/biblioteca')} /> : !!error && <Button label="Reintentar" onPress={load} />}
    </View>}
    <Toast message={!editing && !moving ? error : ''} onRetry={load} />
    <ActionSheet visible={options} title={data?.folder.name} onClose={() => setOptions(false)} options={[
      { icon: 'edit-2', label: 'Renombrar carpeta', onPress: () => { setName(data.folder.name); setError(''); setEditing(true); } },
      { icon: 'folder', label: 'Mover carpeta', onPress: () => { setDestination(data.folder.parent_id); setError(''); setMoving(true); } },
      { icon: 'trash-2', label: 'Borrar carpeta', destructive: true, onPress: () => setDeleting(true) },
    ]} />
    <ActionSheet visible={editing} title="Renombrar carpeta" onClose={() => { if (!busy) setEditing(false); }}>
      <Field accessibilityLabel="Nombre de la carpeta" value={name} onChangeText={setName} editable={!busy} />
      <Button label={busy ? 'Guardando…' : 'Guardar nombre'} kind="primary" disabled={busy || !name.trim()} onPress={() => run(async () => { await renameFolder(folderId, name); setEditing(false); await load(); })} />
      {!!error && <Text style={[type.small, { color: colors.danger }]}>{error}</Text>}
    </ActionSheet>
    <ActionSheet visible={moving} title="Mover carpeta" onClose={() => { if (!busy) setMoving(false); }}>
      <FolderPicker folders={data?.folders || []} value={destination} onChange={setDestination} disabled={busy} label="Mover a" allowed={(parentId) => canMoveFolder(data?.folders || [], folderId, parentId)} />
      <Button label={busy ? 'Moviendo…' : 'Confirmar movimiento'} kind="primary" disabled={busy || destination === data?.folder.parent_id} onPress={() => run(async () => { await moveFolder(folderId, destination); setMoving(false); await load(); })} />
      {!!error && <Text style={[type.small, { color: colors.danger }]}>{error}</Text>}
    </ActionSheet>
    <ConfirmDeleteSheet visible={deleting} name={data?.folder.name || ''} description="Los mazos quedan sueltos y las subcarpetas suben al nivel anterior." onClose={() => setDeleting(false)} onConfirm={async () => {
      await deleteFolder(folderId);
      router.replace(data?.folder.parent_id == null ? '/biblioteca' : `/carpetas/${data.folder.parent_id}`);
    }} />
  </Screen>;
}
