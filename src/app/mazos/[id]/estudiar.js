import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import FlipCard from "../../../components/FlipCard";
import SwipeCard from "../../../components/SwipeCard";
import { Button, Screen } from "../../../components/ui";
import { listCardsByDeck, reviewCard } from "../../../db/cards";
import { spacing, type } from "../../../theme";

// Barajado Fisher-Yates para no estudiar siempre en el mismo orden.
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Modo Quizlet: se estudia el mazo ENTERO deslizando. Alimenta el algoritmo
// FSRS igual que el repaso diario, pero sin pasar por el Gimnasio Mental.
export default function Estudiar() {
  const { id } = useLocalSearchParams();
  const deckId = Number(id);
  const router = useRouter();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(`/mazos/${deckId}`));

  const [cards, setCards] = useState(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [counts, setCounts] = useState({ good: 0, again: 0 });

  useEffect(() => {
    let alive = true;
    listCardsByDeck(deckId).then((c) => alive && setCards(shuffle(c)));
    return () => {
      alive = false;
    };
  }, [deckId]);

  const grade = async (rating) => {
    const card = cards[index];
    await reviewCard(card, rating, "quizlet");
    setCounts((c) => ({ ...c, [rating]: c[rating] + 1 }));
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  if (cards === null) {
    return (
      <Screen style={styles.center}>
        <Stack.Screen options={{ title: "Estudiar" }} />
        <Text style={type.small}>Cargando…</Text>
      </Screen>
    );
  }

  if (cards.length === 0) {
    return (
      <Screen style={styles.center}>
        <Stack.Screen options={{ title: "Estudiar" }} />
        <Text style={type.body}>Este mazo no tiene tarjetas.</Text>
        <Button label="Volver" kind="ghost" onPress={goBack} />
      </Screen>
    );
  }

  if (index >= cards.length) {
    return (
      <Screen style={styles.center}>
        <Stack.Screen options={{ title: "Estudiar" }} />
        <Text style={type.title}>Mazo completo</Text>
        <Text style={type.body}>
          Sabías: {counts.good} · No sabías: {counts.again}
        </Text>
        <Button label="Volver" kind="primary" onPress={goBack} />
      </Screen>
    );
  }

  const card = cards[index];

  return (
    <Screen>
      <Stack.Screen options={{ title: "Estudiar" }} />
      <Text style={styles.progress}>
        {index + 1} de {cards.length}
      </Text>

      <SwipeCard
        cardKey={card.id}
        onSwipeLeft={() => grade("again")}
        onSwipeRight={() => grade("good")}
      >
        <FlipCard
          front={card.front}
          back={card.back}
          flipped={flipped}
          onFlip={() => setFlipped((f) => !f)}
        />
      </SwipeCard>

      <View style={styles.actions}>
        <Button label="← No la sabía" kind="danger" style={{ flex: 1 }} onPress={() => grade("again")} />
        <Button label="La sabía →" kind="primary" style={{ flex: 1 }} onPress={() => grade("good")} />
      </View>
      <Text style={[type.small, styles.hint]}>Deslizá la tarjeta o usá los botones.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  progress: {
    ...type.small,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  hint: {
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
