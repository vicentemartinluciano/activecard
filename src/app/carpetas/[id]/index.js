import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { databaseErrorMessage } from "../../../lib/databaseError";
import LibraryContent from '../../../components/LibraryContent';
import Toast from '../../../components/Toast';
import { useSyncRefresh } from '../../../components/useSyncRefresh';
import { Button, Screen } from '../../../components/ui';
import { listAllCardsForSearch } from '../../../db/cards';
import { listDecks, listTags } from '../../../db/decks';
import { getFolder, listFolders } from '../../../db/folders';
import { getDecksDailyProgress } from '../../../db/progress';
import { spacing, type } from '../../../theme';

export default function DetalleCarpeta() {
  const { id } = useLocalSearchParams();
  const folderId = Number(id);
  const router = useRouter();
  const [data, setData] = useState(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const load = useCallback(async () => {
    const ticket = ++request.current;
    try {
      const [folder, folders, decks, cards, tags, progressByDeck] = await Promise.all([getFolder(folderId), listFolders(), listDecks(), listAllCardsForSearch(), listTags(), getDecksDailyProgress()]);
      if (ticket !== request.current) return;
      setMissing(!folder); setData(folder ? { folder, folders, decks, cards, tags, progressByDeck } : null); setError('');
    } catch (e) { if (ticket === request.current) setError(databaseErrorMessage(e, e.message || 'No pudimos cargar esta carpeta.')); }
  }, [folderId]);
  useFocusEffect(useCallback(() => { load(); return () => { request.current++; }; }, [load]));
  const currentData = data?.folder.id === folderId ? data : null;
  useSyncRefresh(load);
  return <Screen>
    <Stack.Screen options={{ title: currentData?.folder.name || 'Carpeta', headerShown: Platform.OS !== 'web' }} />
    {currentData && !missing ? <LibraryContent key={folderId} {...currentData} folderId={folderId} onRefresh={load} /> : <View style={{ gap: spacing.md }}>
      <Text style={type.body}>{missing ? 'Esta carpeta ya no está disponible.' : error || 'Cargando carpeta…'}</Text>
      {missing ? <Button label="Ir a Biblioteca" onPress={() => router.replace('/biblioteca')} /> : !!error && <Button label="Reintentar" onPress={load} />}
    </View>}
    <Toast message={error} onRetry={load} />
  </Screen>;
}
