import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import LibraryContent from '../../components/LibraryContent';
import SectionSwipe from '../../components/SectionSwipe';
import Skeleton from '../../components/Skeleton';
import Toast from '../../components/Toast';
import { Screen } from '../../components/ui';
import { listAllCardsForSearch, listDecksWithIdeas } from '../../db/cards';
import { listDecks, listTags } from '../../db/decks';
import { listFolders } from '../../db/folders';
import { getDecksDailyProgress } from '../../db/progress';
import { spacing } from '../../theme';

export default function Biblioteca() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const request = useRef(0);
  const load = useCallback(async () => {
    const ticket = ++request.current;
    try {
      const [decks, folders, tags, cards, progressByDeck, ideas] = await Promise.all([listDecks(), listFolders(), listTags(), listAllCardsForSearch(), getDecksDailyProgress(), listDecksWithIdeas()]);
      if (ticket === request.current) { setData({ decks, folders, tags, cards, progressByDeck, hasIdeas: ideas.length > 0 }); setError(''); }
    } catch { if (ticket === request.current) setError('No pudimos cargar la Biblioteca.'); }
  }, []);
  useFocusEffect(useCallback(() => { load(); return () => { request.current++; }; }, [load]));
  return <SectionSwipe index={2}><Screen safeTop>
    {data ? <LibraryContent {...data} onRefresh={load} /> : <View style={{ gap: spacing.sm }}><Skeleton height={96} /><Skeleton height={96} /><Skeleton height={96} /></View>}
    <Toast message={error} onRetry={load} />
  </Screen></SectionSwipe>;
}
