import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { createDeck } from '../db/decks';
import { createFolder, listFolders } from '../db/folders';
import { spacing, type, colors } from '../theme';
import ActionSheet from './ActionSheet';
import FolderPicker from './FolderPicker';
import { Button, Field } from './ui';

export default function CreationSheet({ kind, folderId = null, onClose }) {
  const router = useRouter();
  const [step, setStep] = useState(kind);
  const [folders, setFolders] = useState([]);
  const [destination, setDestination] = useState(folderId);
  const [name, setName] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    if (!kind) return;
    let alive = true;
    setStep(kind); setDestination(folderId); setName(''); setError(''); setLoaded(false);
    listFolders().then((items) => { if (alive) { setFolders(items); setLoaded(true); } }).catch(() => { if (alive) setError('No pudimos cargar las ubicaciones. Cerrá y volvé a intentar.'); });
    return () => { alive = false; };
  }, [kind, folderId]);
  const submit = async () => {
    if (lock.current || !loaded) return;
    lock.current = true; setBusy(true); setError('');
    try {
      // Releer antes de salir hacia IA, incluso si cambió por sync mientras se elegía.
      const latest = await listFolders(); setFolders(latest);
      if (destination != null && !latest.some((f) => f.id === destination)) throw new Error('La carpeta de destino ya no existe. Elegí otra ubicación.');
      if (step === 'ia') {
        onClose(); router.push({ pathname: '/crear/ia', params: { folderId: destination ?? 'root' } });
      } else {
        const id = step === 'carpeta' ? await createFolder(name, destination) : await createDeck(name, destination);
        onClose(); router.push(step === 'carpeta' ? `/carpetas/${id}` : `/mazos/${id}`);
      }
    } catch (e) { setError(e.message || 'No pudimos crear el contenido. Intentá de nuevo.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <ActionSheet visible={!!kind} title={step === 'carpeta' ? 'Nueva carpeta' : step === 'ia' ? 'Nuevo mazo con IA' : 'Nuevo mazo'} onClose={() => { if (!lock.current) onClose(); }}>
    <ScrollView style={{ maxHeight: 480, flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md }}>
      {step === 'choose' ? <>
        <Button label="Manual" onPress={() => setStep('mazo')} />
        <Button label="Con IA" onPress={() => setStep('ia')} />
      </> : <>
        {step !== 'ia' && <Field accessibilityLabel={step === 'carpeta' ? 'Nombre de la carpeta' : 'Nombre del mazo'} placeholder={step === 'carpeta' ? 'Nombre de la carpeta…' : 'Nombre del mazo…'} value={name} onChangeText={setName} editable={!busy} onSubmitEditing={() => { if (name.trim()) submit(); }} />}
        <FolderPicker folders={folders} value={destination} onChange={setDestination} disabled={busy || !loaded} />
        {step === 'ia' && <Text style={type.small}>Revisás las propuestas antes de crear el mazo y guardar sus tarjetas.</Text>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Button label="Cancelar" disabled={busy} onPress={onClose} />
          <Button label={busy ? 'Preparando…' : step === 'ia' ? 'Continuar con IA' : 'Crear y abrir'} kind="primary" disabled={busy || !loaded || step !== 'ia' && !name.trim()} onPress={submit} />
        </View>
      </>}
      {!!error && <Text accessibilityRole="alert" style={[type.small, { color: colors.danger }]}>{error}</Text>}
    </ScrollView>
  </ActionSheet>;
}
