import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ProgressBar from "../../components/ProgressBar";
import Skeleton from "../../components/Skeleton";
import StreakFlame from "../../components/StreakFlame";
import { Button, Card, Pill } from "../../components/ui";
import { listDecksWithConnections } from "../../db/connections";
import { listDecks } from "../../db/decks";
import { getDecksDailyProgress } from "../../db/progress";
import { getDailyReviewStats } from "../../db/reviewQueue";
import { getStreak } from "../../db/streak";
import { colors, gradients, radius, spacing, textColors, type } from "../../theme";

export default function Inicio() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [streak, setStreak] = useState(null);
  const [inProgressDecks, setInProgressDecks] = useState([]);
  const [gymDecks, setGymDecks] = useState([]);
  const [loaded, setLoaded] = useState(false); // false solo hasta el primer fetch exitoso

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      getDailyReviewStats()
        .then((s) => {
          if (!alive) return;
          setStats(s);
          setLoaded(true);
        })
        .catch((e) => {
          console.warn("No se pudo leer la cola de repaso:", e);
          if (!alive) return;
          setStats(null);
          setLoaded(true);
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

      listDecksWithConnections()
        .then((g) => alive && setGymDecks(g))
        .catch(() => alive && setGymDecks([]));

      return () => {
        alive = false;
      };
    }, [])
  );

  const remaining = stats ? stats.remaining : null;
  const completedToday = stats && stats.total > 0 && stats.remaining === 0;
  const totalConnections = gymDecks.reduce((s, d) => s + d.connection_count, 0);

  if (!loaded) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.body}>
          <Skeleton height={200} style={{ borderRadius: radius.lg }} />
          <Skeleton height={72} />
          <Skeleton height={72} />
          <Skeleton height={72} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => router.push("/ajustes")}
          hitSlop={8}
          style={({ pressed }) => [styles.identity, pressed && { opacity: 0.7 }]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>M</Text>
          </View>
          <View>
            <Text style={type.label}>ESTUDIO ACTIVO</Text>
            <Text style={styles.greeting}>¡Hola, Martín!</Text>
          </View>
        </Pressable>

        <View style={styles.streakPill}>
          <StreakFlame days={streak ? streak.days : null} active={!!streak && streak.activeToday} />
          <Text style={styles.streakLabel}>días</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Pill
            label="ACTIVE RECALL"
            color={colors.accentText}
            style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent }}
          />
          <Text style={styles.heroTitle}>Repaso de hoy</Text>
          {completedToday ? (
            <Text style={styles.heroDone}>Completado ✓</Text>
          ) : (
            <Text style={styles.heroSubtitle}>
              Tus prioridades estiman{" "}
              <Text style={styles.heroSubtitleBold}>
                {remaining != null ? remaining : "–"}{" "}
                {remaining === 1 ? "tarjeta" : "tarjetas"}
              </Text>{" "}
              para mantener fresca tu memoria.
            </Text>
          )}
          {stats && stats.total > 0 ? (
            <ProgressBar
              pct={stats.pct}
              gradient={gradients.progress}
              style={{ marginTop: spacing.sm }}
            />
          ) : null}
          <Button
            label={completedToday ? "Repasar de nuevo" : "Repasar ahora →"}
            kind="inverse"
            onPress={() => router.push("/repaso")}
            style={{ marginTop: spacing.md }}
          />
        </LinearGradient>

        {inProgressDecks.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={type.label}>EN PROGRESO</Text>
              <Pressable onPress={() => router.push("/biblioteca")} hitSlop={8}>
                <Text style={styles.sectionLink}>Ver todos</Text>
              </Pressable>
            </View>
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
                  <ProgressBar pct={d.progress.pct} gradient={gradients.progress} style={{ marginTop: 6 }} />
                </View>
                <Text style={styles.deckPct}>
                  {d.progress.reviewedToday}/{d.progress.total}
                </Text>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </Card>
            ))}
          </View>
        ) : null}

        {totalConnections > 0 ? (
          <Card
            level="high"
            onPress={() => router.push("/carpetas/gimnasio")}
            style={styles.deckRow}
          >
            <View style={styles.gymIcon}>
              <Feather name="zap" size={20} color={textColors.violeta} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.body, { fontWeight: "700" }]}>Gimnasio Mental</Text>
              <Text style={type.small}>{totalConnections} conexiones consolidadas</Text>
            </View>
            <Pill label="AUDITORÍA IA" color={textColors.violeta} />
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </Card>
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
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  greeting: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.streakSoft,
    borderWidth: 1,
    borderColor: colors.pillBorder,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  streakLabel: {
    color: colors.streak,
    fontWeight: "700",
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
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
  },
  heroSubtitle: {
    ...type.subtitle,
    lineHeight: 20,
  },
  heroSubtitleBold: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  heroDone: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.successBright,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionLink: {
    ...type.small,
    color: colors.accentText,
    fontWeight: "600",
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
  gymIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
});
