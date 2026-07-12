import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import FlipCard from "../../../components/FlipCard";
import ProgressBar from "../../../components/ProgressBar";
import SwipeCard from "../../../components/SwipeCard";
import { Button, Card, Pill, Screen } from "../../../components/ui";
import { listCardsByDeck, reviewCard } from "../../../db/cards";
import { listDeckCardsNotReviewedToday } from "../../../db/progress";
import { buildFailedRound, shuffle } from "../../../lib/studySession";
import { colors, spacing, type } from "../../../theme";

// Modo Quizlet: se estudia el mazo deslizando. Alimenta el algoritmo FSRS
// igual que el repaso diario, pero sin pasar por el Gimnasio Mental. La
// sesión NO repite lo que ya estudiaste hoy en este modo (se deriva de
// review_logs, así que sobrevive a salir y volver a entrar) y, al terminar,
// ofrece una ronda extra opcional con lo que salió mal.
export default function Estudiar() {
  const { id } = useLocalSearchParams();
  const deckId = Number(id);
  const router = useRouter();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(`/mazos/${deckId}`));

  // status: 'loading' | 'done-today' | 'empty' | 'studying'
  const [status, setStatus] = useState("loading");
  const [round, setRound] = useState([]); // tarjetas de la ronda actual (barajadas)
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [counts, setCounts] = useState({ good: 0, again: 0 });
  const [failedIds, setFailedIds] = useState([]);

  const startRound = useCallback((cards) => {
    setRound(shuffle(cards));
    setIndex(0);
    setFlipped(false);
    setCounts({ good: 0, again: 0 });
    setFailedIds([]);
    setStatus("studying");
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [all, pool] = await Promise.all([
        listCardsByDeck(deckId),
        listDeckCardsNotReviewedToday(deckId),
      ]);
      if (!alive) return;
      if (all.length === 0) {
        setStatus("empty");
      } else if (pool.length === 0) {
        setStatus("done-today");
      } else {
        startRound(pool);
      }
    })();
    return () => {
      alive = false;
    };
  }, [deckId, startRound]);

  const grade = async (rating) => {
    const card = round[index];
    await reviewCard(card, rating, "quizlet");
    setCounts((c) => ({ ...c, [rating]: c[rating] + 1 }));
    if (rating === "again") setFailedIds((f) => [...f, card.id]);
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  const studyAgain = async () => {
    const all = await listCardsByDeck(deckId);
    startRound(all);
  };

  const reviewFailed = () => {
    startRound(buildFailedRound(round, failedIds));
  };

  if (status === "loading") {
    return (
      <Screen style={styles.center}>
        <Stack.Screen options={{ title: "Estudiar" }} />
        <Text style={type.small}>Cargando…</Text>
      </Screen>
    );
  }

  if (status === "empty") {
    return (
      <Screen style={styles.center}>
        <Stack.Screen options={{ title: "Estudiar" }} />
        <Text style={type.body}>Este mazo no tiene tarjetas.</Text>
        <Button label="Volver" kind="ghost" onPress={goBack} />
      </Screen>
    );
  }

  if (status === "done-today") {
    return (
      <Screen style={styles.center}>
        <Stack.Screen options={{ title: "Estudiar" }} />
        <Text style={type.title}>Ya completaste este mazo hoy</Text>
        <Text style={type.body}>Podés repasarlo de nuevo si querés reforzarlo.</Text>
        <Button label="Estudiar de nuevo" kind="primary" onPress={studyAgain} />
        <Button label="Volver" kind="ghost" onPress={goBack} />
      </Screen>
    );
  }

  if (index >= round.length) {
    return (
      <Screen style={styles.center}>
        <Stack.Screen options={{ title: "Estudiar" }} />
        <Card style={styles.summary}>
          <Text style={type.title}>Ronda completa</Text>
          <View style={styles.summaryPills}>
            <Pill color={colors.successBright} label={`Sabías: ${counts.good}`} />
            <Pill color={colors.danger} label={`No sabías: ${counts.again}`} />
          </View>
          {failedIds.length > 0 ? (
            <Button
              label={`Repasar las falladas (${failedIds.length})`}
              kind="primary"
              onPress={reviewFailed}
            />
          ) : null}
          <Button label="Volver" kind="ghost" onPress={goBack} />
        </Card>
      </Screen>
    );
  }

  const card = round[index];

  return (
    <Screen>
      <Stack.Screen options={{ title: "Estudiar" }} />
      <ProgressBar
        pct={(index / round.length) * 100}
        color={colors.accent}
        style={{ marginBottom: spacing.sm }}
      />
      <Text style={styles.progress}>
        {index + 1} de {round.length}
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
  summary: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  summaryPills: {
    flexDirection: "row",
    gap: spacing.sm,
  },
});
