import { Feather } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import ChatAuditor from "../components/ChatAuditor";
import ConfettiOverlay from "../components/ConfettiOverlay";
import FlipCard from "../components/FlipCard";
import ProgressBar from "../components/ProgressBar";
import Skeleton from "../components/Skeleton";
import SwipeCard from "../components/SwipeCard";
import { Button, EmptyState, Pill, Screen } from "../components/ui";
import { getCard, reviewCard, setCardStarred, snapshotFsrs, undoReview } from "../db/cards";
import { getDailyQueue } from "../db/reviewQueue";
import { buildFailedRound } from "../lib/studySession";
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

// Repaso diario con el MISMO sistema que el modo mazo: calificás → siguiente,
// ronda extra de falladas al final. El Gimnasio Mental ya NO interrumpe cada
// tarjeta: solo aparece si armaste el rayo ⚡ de ESA tarjeta (one-shot).
export default function Repaso() {
  const router = useRouter();
  const goHome = () => (router.canGoBack() ? router.back() : router.replace("/"));

  // status: 'loading' | 'empty' | 'studying'
  const [status, setStatus] = useState("loading");
  const [round, setRound] = useState([]); // ronda actual (la cola ya viene ordenada por stride)
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [phase, setPhase] = useState("card"); // 'card' | 'gym' (solo con el rayo armado)
  const [gymArmed, setGymArmed] = useState(false);
  const [counts, setCounts] = useState({ good: 0, hard: 0, again: 0, connections: 0 });
  const [failedIds, setFailedIds] = useState([]);
  const [history, setHistory] = useState([]); // { index, cardId, prev, logId, rating }
  // Id de la tarjeta que se fue a editar: al volver a foco releemos SOLO esa.
  const pendingEditIdRef = useRef(null);

  const startRound = useCallback((cards) => {
    setRound(cards);
    setIndex(0);
    setFlipped(false);
    setPhase("card");
    setGymArmed(false);
    setCounts({ good: 0, hard: 0, again: 0, connections: 0 });
    setFailedIds([]);
    setHistory([]);
    setStatus("studying");
  }, []);

  useEffect(() => {
    let alive = true;
    getDailyQueue().then((q) => {
      if (!alive) return;
      if (q.length === 0) setStatus("empty");
      else startRound(q);
    });
    return () => {
      alive = false;
    };
  }, [startRound]);

  const next = () => {
    setPhase("card");
    setGymArmed(false);
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  const grade = async (rating) => {
    const card = round[index];
    const prev = snapshotFsrs(card);
    const updated = await reviewCard(card, rating, "daily");
    setHistory((h) => [...h, { index, cardId: card.id, prev, logId: updated.logId, rating }]);
    setCounts((c) => ({ ...c, [rating]: c[rating] + 1 }));
    if (rating === "again") setFailedIds((f) => [...f, card.id]);
    if (gymArmed) setPhase("gym");
    else next();
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
    setPhase("card");
    setGymArmed(false);
  };

  const finishGym = (result) => {
    if (result && result.validated) {
      setCounts((c) => ({ ...c, connections: c.connections + 1 }));
    }
    next();
  };

  // Editar la tarjeta actual sin salir del repaso. La cola diaria mezcla mazos,
  // así que el editor se abre con el deck de la propia tarjeta.
  const editCard = (card) => {
    pendingEditIdRef.current = card.id;
    router.push(`/mazos/${card.deck_id}/tarjeta?cardId=${card.id}`);
  };

  // Al volver del editor, releemos SOLO la tarjeta editada y mergeamos su texto
  // en la ronda en memoria (front/back nada más, para no pisar el estado FSRS).
  useFocusEffect(
    useCallback(() => {
      const editedId = pendingEditIdRef.current;
      if (editedId == null) return;
      pendingEditIdRef.current = null;
      let alive = true;
      getCard(editedId).then((fresh) => {
        if (!alive) return;
        if (!fresh) {
          setRound((r) => r.filter((c) => c.id !== editedId));
          setFlipped(false);
        } else {
          setRound((r) =>
            r.map((c) => (c.id === editedId ? { ...c, front: fresh.front, back: fresh.back } : c))
          );
        }
      });
      return () => {
        alive = false;
      };
    }, [])
  );

  const reviewFailed = () => {
    startRound(buildFailedRound(round, failedIds));
  };

  if (status === "loading") {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Repaso" }} />
        <Skeleton height={8} style={{ borderRadius: 999, marginBottom: spacing.md }} />
        <Skeleton style={{ flex: 1, marginVertical: spacing.sm }} />
        <View style={styles.grade}>
          <Skeleton height={56} style={{ width: 56, borderRadius: 999 }} />
          <Skeleton height={56} style={{ width: 56, borderRadius: 999 }} />
          <Skeleton height={56} style={{ width: 56, borderRadius: 999 }} />
        </View>
      </Screen>
    );
  }

  if (status === "empty") {
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

  if (index >= round.length) {
    const hasReviews = counts.good + counts.hard + counts.again > 0;
    return (
      <Screen style={styles.center}>
        <Stack.Screen options={{ title: "Repaso" }} />
        <View style={styles.summaryNeon}>
          <Text style={styles.summaryTitle}>Repaso terminado</Text>
          <View style={styles.summaryPills}>
            <Pill color="#5BE7AD" label={`Recordadas: ${counts.good}`} />
            <Pill color={colors.accentText} label={`Más o menos: ${counts.hard}`} />
            <Pill color={colors.danger} label={`Olvidadas: ${counts.again}`} />
          </View>
          {counts.connections > 0 ? (
            <Pill color={colors.accentText} label={`Conexiones creadas: ${counts.connections}`} />
          ) : null}
          {failedIds.length > 0 ? (
            <Button
              label={`Repasar las falladas (${failedIds.length})`}
              kind="primary"
              onPress={reviewFailed}
            />
          ) : null}
          <Button
            label="Volver al inicio"
            kind={failedIds.length > 0 ? "default" : "primary"}
            onPress={goHome}
          />
          {history.length > 0 ? (
            <Button label="Deshacer última" kind="ghost" onPress={undo} />
          ) : null}
        </View>
        {hasReviews ? <ConfettiOverlay /> : null}
        {hasReviews ? <SummaryHaptic /> : null}
      </Screen>
    );
  }

  const card = round[index];

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
        pct={(index / round.length) * 100}
        gradient={gradients.progress}
        glowStyle={glow.green}
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
          onSwipeLeft={() => grade("again")}
          onSwipeRight={() => grade("good")}
          onSwipeUp={() => grade("hard")}
        >
          <FlipCard
            cardId={card.id}
            front={card.front}
            back={card.back}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
            starred={!!card.starred}
            onToggleStar={async () => {
              const v = card.starred ? 0 : 1;
              await setCardStarred(card.id, v);
              setRound((r) => r.map((c) => (c.id === card.id ? { ...c, starred: v } : c)));
            }}
            gymArmed={gymArmed}
            onToggleGym={() => setGymArmed((g) => !g)}
            onEdit={() => editCard(card)}
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
          onPress={() => grade("hard")}
          style={({ pressed }) => [styles.circle, styles.circleMid, pressed && { opacity: 0.7 }]}
        >
          <Feather name="minus" size={26} color={colors.accentText} />
        </Pressable>
        <Pressable
          onPress={() => grade("good")}
          style={({ pressed }) => [styles.circle, styles.circleYes, pressed && { opacity: 0.7 }]}
        >
          <Feather name="check" size={26} color="#5BE7AD" />
        </Pressable>
      </View>
      {gymArmed ? (
        <Text style={[type.small, styles.hint]}>
          ⚡ Al calificar esta tarjeta se abre el Gimnasio Mental.
        </Text>
      ) : null}
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
  grade: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 28,
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
  circleMid: {
    borderColor: "rgba(143,166,243,0.45)",
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
