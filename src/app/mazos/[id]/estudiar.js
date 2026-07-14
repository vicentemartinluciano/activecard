import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import ConfettiOverlay from "../../../components/ConfettiOverlay";
import FlipCard from "../../../components/FlipCard";
import ProgressBar from "../../../components/ProgressBar";
import Skeleton from "../../../components/Skeleton";
import SwipeCard from "../../../components/SwipeCard";
import { Button, EmptyState, Pill, Screen } from "../../../components/ui";
import { listCardsByDeck, reviewCard, snapshotFsrs, undoReview } from "../../../db/cards";
import { listDeckCardsNotReviewedToday } from "../../../db/progress";
import { buildFailedRound, shuffle } from "../../../lib/studySession";
import { colors, gradients, radius, spacing, type } from "../../../theme";

// Vibración de éxito al entrar al resumen — montado solo ahí, no en cada
// render de la pantalla de estudio.
function SummaryHaptic() {
  useEffect(() => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, []);
  return null;
}

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
  const [history, setHistory] = useState([]); // { index, cardId, prev, logId, rating }

  const startRound = useCallback((cards) => {
    setRound(shuffle(cards));
    setIndex(0);
    setFlipped(false);
    setCounts({ good: 0, again: 0 });
    setFailedIds([]);
    setHistory([]);
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
    const prev = snapshotFsrs(card);
    const updated = await reviewCard(card, rating, "quizlet");
    setHistory((h) => [...h, { index, cardId: card.id, prev, logId: updated.logId, rating }]);
    setCounts((c) => ({ ...c, [rating]: c[rating] + 1 }));
    if (rating === "again") setFailedIds((f) => [...f, card.id]);
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  const undo = async () => {
    const last = history[history.length - 1];
    if (!last) return;
    await undoReview(last.cardId, last.prev, last.logId);
    setHistory((h) => h.slice(0, -1));
    setCounts((c) => ({ ...c, [last.rating]: c[last.rating] - 1 }));
    if (last.rating === "again") {
      setFailedIds((f) => {
        const i = f.lastIndexOf(last.cardId);
        return i === -1 ? f : [...f.slice(0, i), ...f.slice(i + 1)];
      });
    }
    setIndex(last.index);
    setFlipped(false);
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
      <Screen>
        <Stack.Screen options={{ title: "Estudiar" }} />
        <Skeleton height={8} style={{ borderRadius: 999, marginBottom: spacing.md }} />
        <Skeleton style={{ flex: 1, marginVertical: spacing.sm }} />
        <View style={styles.actions}>
          <Skeleton height={48} style={{ flex: 1 }} />
          <Skeleton height={48} style={{ flex: 1 }} />
        </View>
      </Screen>
    );
  }

  if (status === "empty") {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Estudiar" }} />
        <EmptyState full icon="inbox" text="Este mazo no tiene tarjetas." />
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
    const hasReviews = counts.good + counts.again > 0;
    return (
      <Screen style={styles.center}>
        <Stack.Screen options={{ title: "Estudiar" }} />
        <LinearGradient
          colors={gradients.bar}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryShiny}
        >
          <Text style={styles.summaryTitle}>Ronda completa</Text>
          <View style={styles.summaryPills}>
            <Pill
              color={colors.successBright}
              label={`Sabías: ${counts.good}`}
              style={styles.shinyPill}
            />
            <Pill color={colors.danger} label={`No sabías: ${counts.again}`} style={styles.shinyPill} />
          </View>
          {failedIds.length > 0 ? (
            <Button
              label={`Repasar las falladas (${failedIds.length})`}
              kind="primary"
              onPress={reviewFailed}
            />
          ) : null}
          <Button label="Volver" kind="ghost" labelStyle={{ color: "#FFFFFF" }} onPress={goBack} />
          {history.length > 0 ? (
            <Button
              label="Deshacer última"
              kind="ghost"
              labelStyle={{ color: "#FFFFFF" }}
              onPress={undo}
            />
          ) : null}
        </LinearGradient>
        {hasReviews ? <ConfettiOverlay /> : null}
        {hasReviews ? <SummaryHaptic /> : null}
      </Screen>
    );
  }

  const card = round[index];

  return (
    <Screen>
      <Stack.Screen options={{ title: "Estudiar" }} />
      <ProgressBar
        pct={(index / round.length) * 100}
        gradient={gradients.progress}
        style={{ marginBottom: spacing.sm }}
      />
      <View style={styles.progressRow}>
        <Text style={styles.progress}>
          {index + 1} de {round.length}
        </Text>
        <Pressable
          onPress={undo}
          disabled={history.length === 0}
          hitSlop={10}
          style={{ opacity: history.length === 0 ? 0.15 : 0.35 }}
        >
          <Feather name="rotate-ccw" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={{ flex: 1, marginVertical: spacing.sm }}>
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
      </View>

      <View style={styles.grade}>
        <Pressable
          onPress={() => grade("again")}
          style={({ pressed }) => [styles.circle, styles.circleNo, pressed && { opacity: 0.7 }]}
        >
          <Feather name="x" size={26} color={colors.danger} />
        </Pressable>
        <Pressable
          onPress={() => grade("good")}
          style={({ pressed }) => [styles.circle, styles.circleYes, pressed && { opacity: 0.7 }]}
        >
          <Feather name="check" size={26} color="#5BE7AD" />
        </Pressable>
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
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  progress: {
    ...type.small,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  grade: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 44,
    marginTop: spacing.lg,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  circleNo: {
    borderColor: "rgba(229,72,77,0.45)",
  },
  circleYes: {
    borderColor: "rgba(91,231,173,0.45)",
  },
  hint: {
    textAlign: "center",
    marginTop: spacing.sm,
  },
  summaryShiny: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  summaryTitle: {
    ...type.title,
    color: "#FFFFFF",
  },
  summaryPills: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  shinyPill: {
    backgroundColor: "#FFFFFF22",
    borderColor: "#FFFFFF33",
  },
});
