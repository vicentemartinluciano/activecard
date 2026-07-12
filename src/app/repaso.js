import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import ChatAuditor from "../components/ChatAuditor";
import FlipCard from "../components/FlipCard";
import ProgressBar from "../components/ProgressBar";
import { Button, Card, Pill, Screen } from "../components/ui";
import { reviewCard } from "../db/cards";
import { getDailyQueue } from "../db/reviewQueue";
import { colors, radius, spacing, type } from "../theme";

export default function Repaso() {
  const router = useRouter();
  const goHome = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const [queue, setQueue] = useState(null); // null = cargando
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [phase, setPhase] = useState("card"); // 'card' | 'gym'
  const [counts, setCounts] = useState({ good: 0, again: 0, connections: 0 });

  useEffect(() => {
    let alive = true;
    getDailyQueue().then((q) => alive && setQueue(q));
    return () => {
      alive = false;
    };
  }, []);

  const grade = async (rating) => {
    const card = queue[index];
    await reviewCard(card, rating, "daily");
    setCounts((c) => ({ ...c, [rating]: c[rating] + 1 }));
    // Tanto si la recordó como si no: espacio de asociación (Gimnasio Mental).
    setPhase("gym");
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
      <Screen style={styles.center}>
        <Stack.Screen options={{ title: "Repaso" }} />
        <Text style={type.small}>Cargando…</Text>
      </Screen>
    );
  }

  if (queue.length === 0) {
    return (
      <Screen style={styles.center}>
        <Stack.Screen options={{ title: "Repaso" }} />
        <Text style={type.body}>No hay nada para repasar hoy.</Text>
        <Text style={type.small}>Volvé mañana, o creá tarjetas nuevas.</Text>
        <Button label="Volver" kind="ghost" onPress={goHome} />
      </Screen>
    );
  }

  if (index >= queue.length) {
    return (
      <Screen style={styles.center}>
        <Stack.Screen options={{ title: "Repaso" }} />
        <Card style={styles.summary}>
          <Text style={type.title}>Repaso terminado</Text>
          <View style={styles.summaryPills}>
            <Pill color={colors.successBright} label={`Recordadas: ${counts.good}`} />
            <Pill color={colors.danger} label={`Olvidadas: ${counts.again}`} />
          </View>
          {counts.connections > 0 ? (
            <Pill color={colors.accentText} label={`Conexiones creadas: ${counts.connections}`} />
          ) : null}
          <Button label="Volver al inicio" kind="primary" onPress={goHome} />
        </Card>
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
            {card.front}
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
        color={colors.successBright}
        style={{ marginBottom: spacing.sm }}
      />
      <Text style={styles.progress}>
        {index + 1} de {queue.length}
      </Text>

      <FlipCard
        front={card.front}
        back={card.back}
        flipped={flipped}
        onFlip={() => setFlipped((f) => !f)}
      />

      <View style={styles.actions}>
        {flipped ? (
          <>
            <Button
              label="No lo recordaba"
              kind="danger"
              style={{ flex: 1 }}
              onPress={() => grade("again")}
            />
            <Button
              label="Lo recordaba"
              kind="primary"
              style={{ flex: 1 }}
              onPress={() => grade("good")}
            />
          </>
        ) : (
          <Text style={[type.small, styles.flipHint]}>
            Respondé mentalmente y después dá vuelta la tarjeta.
          </Text>
        )}
      </View>
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
    minHeight: 44,
    alignItems: "center",
  },
  flipHint: {
    flex: 1,
    textAlign: "center",
    color: colors.textMuted,
  },
  gymConcept: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    padding: spacing.sm + 4,
    marginBottom: spacing.sm,
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
