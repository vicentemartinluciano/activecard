import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ProgressBar from "../../components/ProgressBar";
import StreakFlame from "../../components/StreakFlame";
import { Button } from "../../components/ui";
import { getDailyReviewStats } from "../../db/reviewQueue";
import { colors, radius, spacing, type } from "../../theme";

export default function Inicio() {
  const router = useRouter();
  const [stats, setStats] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getDailyReviewStats()
        .then((s) => alive && setStats(s))
        .catch((e) => {
          console.warn("No se pudo leer la cola de repaso:", e);
          if (alive) setStats(null);
        });
      return () => {
        alive = false;
      };
    }, [])
  );

  const remaining = stats ? stats.remaining : null;
  const completedToday = stats && stats.total > 0 && stats.remaining === 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={type.title}>ActiveCard</Text>
          <Text style={type.subtitle}>Soberanía mental, un día a la vez.</Text>
        </View>
        <View style={styles.headerRight}>
          <StreakFlame />
          <Pressable
            onPress={() => router.push("/ajustes")}
            hitSlop={10}
            style={({ pressed }) => pressed && { opacity: 0.6 }}
          >
            <Feather name="settings" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.heroCard}>
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
            <ProgressBar pct={stats.pct} style={{ marginTop: spacing.sm }} />
          ) : null}
          <Button
            label={completedToday ? "Repasar de nuevo" : "Repasar"}
            kind="primary"
            onPress={() => router.push("/repaso")}
            style={{ marginTop: spacing.md }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  heroCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  heroLabel: {
    ...type.small,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  heroCount: {
    fontSize: 40,
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
    color: colors.success,
  },
});
