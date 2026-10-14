import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, EmptyState, Screen } from '../components/ui';
import Skeleton from '../components/Skeleton';
import { getDeck } from '../db/decks';
import { widgetDestination } from '../widgets/model';

export default function WidgetDestination() {
  const { target, deckId } = useLocalSearchParams();
  const router = useRouter();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    async function open() {
      // getDeck espera apertura + migración: enlaces seguros en arranque frío.
      const valid = /^\d+$/.test(String(deckId)) && Number.isSafeInteger(Number(deckId)) && Number(deckId) > 0;
      const deck = valid && ['study', 'deck'].includes(target) ? await getDeck(Number(deckId)) : null;
      if (active) router.replace(widgetDestination(target, deckId, !!deck));
    }
    open().catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [target, deckId, router, retry]);
  return <Screen>
    <Stack.Screen options={{ headerShown: false }} />
    {error ? <>
      <EmptyState text="No pudimos abrir el mazo. Volvé a intentar leer tus datos locales." icon="alert-circle" />
      <Button label="Reintentar" onPress={() => setRetry((value) => value + 1)} />
      <Button label="Ir a Biblioteca" onPress={() => router.replace('/biblioteca')} />
    </> : <Skeleton height={140} />}
  </Screen>;
}
