import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ProgressBar from "../../components/ProgressBar";
import StreakFlame from "../../components/StreakFlame";
import { Button, Card } from "../../components/ui";
import { listDecks } from "../../db/decks";
import { getDecksDailyProgress } from "../../db/progress";
import { getDailyReviewStats } from "../../db/reviewQueue";
import { getStreak } from "../../db/streak";
import { colors, gradients, radius, spacing, type } from "../../theme";

export default function Inicio() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [streak, setStreak] = useState(null);
  const [inProgressDecks, setInProgressDecks] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      getDailyReviewStats()
        .then((s) => alive && setStats(s))
        .catch((e) => {
          console.warn("No se pudo leer la cola de repaso:", e);
          if (alive) setStats(null);
        });

      getStreak()
        .then((s) => alive && setStreak(s))
        .catch(() => alive && setStreak(null));

      Promise.all([listDecks(), getDecksDailyProgress()])
        .then(([decks, progressByDeck]) => {
          if (!alive) return;
          const withProgress = decks
            .map((d) => ({ ...d, progress: progressByDeck[d.id] }))
            .filter((d) => d.progress && d.progress.pct > 0 && d.progress.pct < 100)
            .slice(0, 3);
          setInProgressDecks(withProgress);
        })
        .catch(() => alive && setInProgressDecks([]));

      return () => {
        alive = false;
      };
    }, [])
  );

  const remaining = stats ? stats.remaining : null;
  const completedToday = stats && stats.total > 0 && stats.remaining === 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topRow}>
        <StreakFlame days={streak ? streak.days : null} active={!!streak && streak.activeToday} />
        <Pressable
          onPress={() => router.push("/ajustes")}
          hitSlop={10}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <Feather name="settings" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroLabel}>Repaso de hoy</Text>
          {completedToday ? (
            <Text style={styles.heroDone}>Completado ✓</Text>
          ) : (
            <Text style={styles.heroCount}>
              {remaining != null ? remaining : "–"}
              <Text style={styles.heroCountHint}>
                {" "}
                {remaining === 1 ? "tarjeta pendiente" : "tarjetas pendientes"}
              </Text>
            </Text>
          )}
          {stats && stats.total > 0 ? (
            <ProgressBar
              pct={stats.pct}
              color={colors.successBright}
              style={{ marginTop: spacing.sm }}
            />
          ) : null}
          <Button
            label={completedToday ? "REPASAR DE NUEVO" : "REPASAR AHORA"}
            kind="inverse"
            onPress={() => router.push("/repaso")}
            style={{ marginTop: spacing.md }}
          />
        </LinearGradient>

        {inProgressDecks.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Seguir estudiando</Text>
            {inProgressDecks.map((d) => (
              <Card
                key={d.id}
                level="high"
                onPress={() => router.push(`/mazos/${d.id}/estudiar`)}
                style={styles.deckRow}
              >
                <Feather name={d.icon || "book"} size={18} color={colors.accentText} />
                <View style={{ flex: 1 }}>
                  <Text style={type.body}>{d.name}</Text>
                  <ProgressBar pct={d.progress.pct} gradient={gradients.bar} style={{ marginTop: 6 }} />
                </View>
                <Text style={styles.deckPct}>{d.progress.pct}%</Text>
              </Card>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  hero: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    overflow: "hidden",
  },
  heroLabel: {
    ...type.label,
    marginBottom: spacing.sm,
  },
  heroCount: {
    fontSize: 48,
    fontWeight: "800",
    color: colors.text,
  },
  heroCountHint: {
    fontSize: 15,
    fontWeight: "400",
    color: colors.textMuted,
  },
  heroDone: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.successBright,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...type.body,
    fontWeight: "700",
  },
  deckRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
  },
  deckPct: {
    ...type.small,
    color: colors.accentText,
    fontWeight: "700",
  },
});
