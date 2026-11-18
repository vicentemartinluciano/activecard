import Feather from "@expo/vector-icons/Feather";
import StarField from "../components/StarField";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import ChatAuditor from "../components/ChatAuditor";
import ConfettiOverlay from "../components/ConfettiOverlay";
import FlipCard from "../components/FlipCard";
import ProgressBar from "../components/ProgressBar";
import ReferenceNotesSheet from "../components/ReferenceNotesSheet";
import Skeleton from "../components/Skeleton";
import SwipeCard from "../components/SwipeCard";
import useDeckReferenceNotes from "../components/useDeckReferenceNotes";
import useStudyKeyboard from "../components/useStudyKeyboard";
import { useSyncRefresh } from "../components/useSyncRefresh";
import { Button, EmptyState, Pill, Screen } from "../components/ui";
import { getCard, reviewCard, setCardStarred, snapshotFsrs, undoReview } from "../db/cards";
import { listDecks } from "../db/decks";
import { getDailyQueue } from "../db/reviewQueue";
import { syncReviewReminder } from "../lib/notifications";
import { previewIntervals } from "../lib/scheduler";
import { buildFailedRound } from "../lib/studySession";
import {
  colors,
  font,
  glow,
  gradients,
  layout,
  radius,
  ratingBorders,
  ratingColors,
  spacing,
  tabular,
  type,
} from "../theme";

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
  const [deckNames, setDeckNames] = useState({});
  // Id de la tarjeta que se fue a editar: al volver a foco releemos SOLO esa.
  const pendingEditIdRef = useRef(null);
  const pendingNoteRefreshRef = useRef(false);
  const swipeRef = useRef(null);
  const [syncReload, setSyncReload] = useState(0);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [notesRefreshKey, setNotesRefreshKey] = useState(0);
  useSyncRefresh(useCallback(() => { setStatus("loading"); setSyncReload((value) => value + 1); setNotesRefreshKey((k) => k + 1); }, []));

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
    Promise.all([getDailyQueue(), Promise.resolve(listDecks?.()).catch(() => [])]).then(([q, decks]) => {
      if (!alive) return;
      setDeckNames(Object.fromEntries((decks || []).map((d) => [d.id, d.name])));
      if (q.length === 0) setStatus("empty");
      else startRound(q);
    });
    return () => {
      alive = false;
    };
  }, [startRound, syncReload]);

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
    // El estado FSRS nuevo tiene que volver a la ronda: la ronda de falladas se
    // arma DESDE `round` (buildFailedRound), y si ahí quedan los objetos de antes
    // del repaso, al acertar en la ronda extra FSRS recalcula desde el estado
    // pre-fallo y el UPDATE pisa `lapses` con el valor viejo. Resultado: la
    // tarjeta que acabás de olvidar se va a semanas y no aparece en "Puntos
    // débiles", que lee cards.lapses. `prev` ya se tomó arriba, así que el
    // deshacer sigue restaurando el estado correcto.
    setRound((r) => r.map((c) => (c.id === card.id ? { ...c, ...updated } : c)));
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

  const finishGym = async (result) => {
    if (result && result.validated) {
      setCounts((c) => ({ ...c, connections: c.connections + 1 }));
    }
    const current = round[index];
    if (current?.id != null) {
      try {
        const fresh = await getCard(current.id);
        if (fresh) {
          setRound((r) =>
            r.map((c) => (c.id === current.id ? { ...c, front: fresh.front, back: fresh.back } : c))
          );
        }
      } catch {
        // Si falla la relectura puntual, continuamos la sesión.
      }
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
      if (pendingNoteRefreshRef.current) {
        pendingNoteRefreshRef.current = false;
        setNotesRefreshKey((k) => k + 1);
      }
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

  const sessionComplete = status === "studying" && round.length > 0 && index >= round.length;
  const activeCard = status === "studying" && index < round.length ? round[index] : null;
  const referenceNotes = useDeckReferenceNotes(activeCard?.deck_id, notesRefreshKey);
  const keyboardError = useStudyKeyboard({ enabled: status === 'studying' && index < round.length && phase === 'card' && !referenceOpen, flipped, flip: () => setFlipped((value) => !value), grade: (rating) => swipeRef.current?.swipe(rating), isBusy: () => swipeRef.current?.isBusy() });
  useEffect(() => {
    if (!sessionComplete) return;
    syncReviewReminder().catch(() => {});
  }, [sessionComplete]);

  const reviewFailed = () => {
    startRound(buildFailedRound(round, failedIds));
  };

  if (status === "loading") {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Repaso", headerShown: true }} />
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
        <Stack.Screen options={{ title: "Repaso", headerShown: true }} />
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
        <Stack.Screen options={{ title: "Repaso", headerShown: true }} />
        <View style={styles.summaryNeon}>
          <Text style={styles.summaryTitle}>Repaso terminado</Text>
          <View style={styles.summaryPills}>
            <Pill color={ratingColors.good} label={`Recordadas: ${counts.good}`} />
            <Pill color={ratingColors.hard} label={`Más o menos: ${counts.hard}`} />
            <Pill color={ratingColors.again} label={`Olvidadas: ${counts.again}`} />
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
  const intervals = previewIntervals(card);
  const currentDeckName = card.deck_name || deckNames[card.deck_id];

  if (phase === "gym") {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ChatAuditor card={card} onDone={finishGym} />
      </Screen>
    );
  }

  return (
    <Screen safeTop background={<StarField />} style={{ maxWidth: layout.studyMaxWidth, paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
      <Stack.Screen options={{ title: "", headerShown: false }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={{ padding: 10 }}><Feather name="arrow-left" size={22} color={colors.text} /></Pressable>
      <ProgressBar
        pct={(index / round.length) * 100}
        gradient={gradients.progress}
        glowStyle={glow.green}
        style={{ flex: 1 }}
      />
      </View>
      <View style={styles.progressRow}>
        <Text style={styles.progress} numberOfLines={1}>
          {index + 1} de {round.length}{currentDeckName ? ` · ${currentDeckName}` : ""}
        </Text>
        {referenceNotes.length > 0 ? (
          <Pill
            icon="file-text"
            color={colors.accentText}
            label={referenceNotes.length > 1 ? `Notas (${referenceNotes.length})` : "Nota"}
            onPress={() => setReferenceOpen(true)}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Deshacer calificación anterior"
          onPress={undo}
          disabled={history.length === 0}
          hitSlop={10}
          style={[styles.undoButton, { opacity: history.length === 0 ? 0.2 : 0.85 }]}
        >
          <Feather name="rotate-ccw" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={{ flex: 1, marginVertical: spacing.sm }}>
        <SwipeCard
          ref={swipeRef}
          cardId={card.id}
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
          accessibilityRole="button" accessibilityLabel="No la recordé"
          onPress={() => Platform.OS === "web" ? swipeRef.current?.swipe("again").catch(() => {}) : grade("again")}
          style={({ pressed }) => [styles.gradeItem, pressed && { opacity: 0.7 }]}
        >
          <View style={[styles.circle, styles.circleNo]}>
            <Feather name="x" size={26} color={ratingColors.again} />
          </View>
          <Text style={styles.gradeLabel}>No sabía</Text>
          <Text style={styles.gradeInterval}>{intervals.again}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button" accessibilityLabel="Más o menos"
          onPress={() => Platform.OS === "web" ? swipeRef.current?.swipe("hard").catch(() => {}) : grade("hard")}
          style={({ pressed }) => [styles.gradeItem, pressed && { opacity: 0.7 }]}
        >
          <View style={[styles.circle, styles.circleMid]}>
            <Feather name="minus" size={26} color={ratingColors.hard} />
          </View>
          <Text style={styles.gradeLabel}>Más o menos</Text>
          <Text style={styles.gradeInterval}>{intervals.hard}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button" accessibilityLabel="La recordé"
          onPress={() => Platform.OS === "web" ? swipeRef.current?.swipe("good").catch(() => {}) : grade("good")}
          style={({ pressed }) => [styles.gradeItem, pressed && { opacity: 0.7 }]}
        >
          <View style={[styles.circle, styles.circleYes]}>
            <Feather name="check" size={26} color={ratingColors.good} />
          </View>
          <Text style={styles.gradeLabel}>La sabía</Text>
          <Text style={styles.gradeInterval}>{intervals.good}</Text>
        </Pressable>
      </View>
      {!!keyboardError && <Text style={{ color: colors.danger, textAlign: 'center' }}>{keyboardError}</Text>}
      {flipped && (card.lapses || 0) >= 3 && !gymArmed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Armar Gimnasio para reformular esta tarjeta con fallos"
          onPress={() => setGymArmed(true)}
          style={({ pressed }) => [styles.leechHint, pressed && { opacity: 0.75 }]}
        >
          <Feather name="zap" size={14} color="#C9A8FF" />
          <Text style={styles.leechHintText}>
            {`Fallada ${card.lapses} veces · Tocá para reformularla en el Gimnasio al calificar`}
          </Text>
        </Pressable>
      ) : null}
      {gymArmed ? (
        <Text style={[type.small, styles.hint]}>
          ⚡ Al calificar esta tarjeta se abre el Gimnasio Mental.
        </Text>
      ) : null}
      <ReferenceNotesSheet
        visible={referenceOpen}
        notes={referenceNotes}
        deckName={currentDeckName || ""}
        onClose={() => setReferenceOpen(false)}
        onEditNote={(noteId) => {
          setReferenceOpen(false);
          pendingNoteRefreshRef.current = true;
          router.push(`/notas/${noteId}`);
        }}
      />
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
  undoButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  grade: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: spacing.md,
  },
  gradeItem: {
    alignItems: "center",
    gap: 6,
    minWidth: 76,
  },
  gradeLabel: {
    fontSize: 12,
    color: colors.textMuted,
    ...font(600),
  },
  gradeInterval: {
    fontSize: 11,
    color: colors.textMuted,
    opacity: 0.75,
    ...tabular,
  },
  leechHint: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(158,110,222,0.35)",
    backgroundColor: "rgba(158,110,222,0.10)",
  },
  leechHintText: {
    fontSize: 12,
    color: "#C9A8FF",
    ...font(600),
    flexShrink: 1,
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
    borderColor: ratingBorders.again,
  },
  circleMid: {
    borderColor: ratingBorders.hard,
  },
  circleYes: {
    borderColor: ratingBorders.good,
  },
  hint: {
    textAlign: "center",
    marginTop: spacing.sm,
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
