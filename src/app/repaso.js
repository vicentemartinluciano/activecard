import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import ChatAuditor from "../components/ChatAuditor";
import ConfettiOverlay from "../components/ConfettiOverlay";
import FlipCard from "../components/FlipCard";
import ProgressBar from "../components/ProgressBar";
import Skeleton from "../components/Skeleton";
import SwipeCard from "../components/SwipeCard";
import { Button, EmptyState, Pill, Screen } from "../components/ui";
import { reviewCard, snapshotFsrs, undoReview } from "../db/cards";
import { getDailyQueue } from "../db/reviewQueue";
import { toPlainText } from "../lib/richtext";
import { colors, glow, gradients, radius, spacing, type } from "../theme";

// Vibración de éxito al entrar al resumen — montado solo ahí, no en cada
// render de la pantalla de repaso.
function SummaryHaptic() {
  useEffect(() => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, []);
  return null;
}

export default function Repaso() {
  const router = useRouter();
  const goHome = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const [queue, setQueue] = useState(null); // null = cargando
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [phase, setPhase] = useState("card"); // 'card' | 'gym'
  const [counts, setCounts] = useState({ good: 0, again: 0, connections: 0 });
  const [history, setHistory] = useState([]); // { index, cardId, prev, logId, rating }

  useEffect(() => {
    let alive = true;
    getDailyQueue().then((q) => alive && setQueue(q));
    return () => {
      alive = false;
    };
  }, []);

  const grade = async (rating) => {
    const card = queue[index];
    const prev = snapshotFsrs(card);
    const updated = await reviewCard(card, rating, "daily");
    setHistory((h) => [...h, { index, cardId: card.id, prev, logId: updated.logId, rating }]);
    setCounts((c) => ({ ...c, [rating]: c[rating] + 1 }));
    // Tanto si la recordó como si no: espacio de asociación (Gimnasio Mental).
    setPhase("gym");
  };

  const undo = async () => {
    const last = history[history.length - 1];
    if (!last) return;
    await undoReview(last.cardId, last.prev, last.logId);
    setHistory((h) => h.slice(0, -1));
    setCounts((c) => ({ ...c, [last.rating]: c[last.rating] - 1 }));
    setIndex(last.index);
    setFlipped(false);
    setPhase("card");
  };

  const finishGym = (result) => {
    if (result && result.validated) {
      setCounts((c) => ({ ...c, connections: c.connections + 1 }));
    }
    setPhase("card");
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  if (queue === null) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Repaso" }} />
        <Skeleton height={8} style={{ borderRadius: 999, marginBottom: spacing.md }} />
        <Skeleton style={{ flex: 1, marginVertical: spacing.sm }} />
        <View style={styles.actions}>
          <Skeleton height={48} style={{ flex: 1 }} />
          <Skeleton height={48} style={{ flex: 1 }} />
        </View>
      </Screen>
    );
  }

  if (queue.length === 0) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Repaso" }} />
        <EmptyState
          full
          icon="check-circle"
          text={"No hay nada para repasar hoy.\nVolvé mañana, o creá tarjetas nuevas."}
        />
        <Button label="Volver" kind="ghost" onPress={goHome} />
      </Screen>
    );
  }

  if (index >= queue.length) {
    const hasReviews = counts.good + counts.again > 0;
    return (
      <Screen style={styles.center}>
        <Stack.Screen options={{ title: "Repaso" }} />
        <View style={styles.summaryNeon}>
          <Text style={styles.summaryTitle}>Repaso terminado</Text>
          <View style={styles.summaryPills}>
            <Pill color="#5BE7AD" label={`Recordadas: ${counts.good}`} />
            <Pill color={colors.danger} label={`Olvidadas: ${counts.again}`} />
          </View>
          {counts.connections > 0 ? (
            <Pill color={colors.accentText} label={`Conexiones creadas: ${counts.connections}`} />
          ) : null}
          <Button label="Volver al inicio" kind="primary" onPress={goHome} />
          {history.length > 0 ? (
            <Button label="Deshacer última" kind="ghost" onPress={undo} />
          ) : null}
        </View>
        {hasReviews ? <ConfettiOverlay /> : null}
        {hasReviews ? <SummaryHaptic /> : null}
      </Screen>
    );
  }

  const card = queue[index];

  if (phase === "gym") {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Repaso" }} />
        <View style={styles.gymConcept}>
          <Text style={type.small} numberOfLines={2}>
            {toPlainText(card.front)}
          </Text>
        </View>
        <ChatAuditor card={card} onDone={finishGym} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Repaso" }} />
      <ProgressBar
        pct={(index / queue.length) * 100}
        gradient={gradients.progress}
        style={{ marginBottom: spacing.sm }}
      />
      <View style={styles.progressRow}>
        <Text style={styles.progress}>
          {index + 1} de {queue.length}
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
  gymConcept: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    padding: spacing.sm + 4,
    marginBottom: spacing.sm,
  },
  summaryNeon: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cyanBorder,
    ...glow.cyan,
  },
  summaryTitle: {
    ...type.title,
  },
  summaryPills: {
    flexDirection: "row",
    gap: spacing.sm,
  },
});
