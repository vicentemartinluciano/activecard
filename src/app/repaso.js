import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import FlipCard from "../components/FlipCard";
import { Button, Screen } from "../components/ui";
import { reviewCard } from "../db/cards";
import { getDailyQueue } from "../db/reviewQueue";
import { colors, spacing, type } from "../theme";

export default function Repaso() {
  const router = useRouter();
  const goHome = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const [queue, setQueue] = useState(null); // null = cargando
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [counts, setCounts] = useState({ good: 0, again: 0 });

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
    // TODO Fase 5: acá se abre el Gimnasio Mental antes de avanzar.
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
        <Text style={type.title}>Repaso terminado</Text>
        <Text style={type.body}>
          Recordadas: {counts.good} · Olvidadas: {counts.again}
        </Text>
        <Button label="Volver al inicio" kind="primary" onPress={goHome} />
      </Screen>
    );
  }

  const card = queue[index];

  return (
    <Screen>
      <Stack.Screen options={{ title: "Repaso" }} />
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
});
