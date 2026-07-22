import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ProgressBar from "../../components/ProgressBar";
import SectionSwipe from "../../components/SectionSwipe";
import Skeleton from "../../components/Skeleton";
import StreakFlame from "../../components/StreakFlame";
import { Button, Card, Pill } from "../../components/ui";
import { listDecks } from "../../db/decks";
import { getDecksDailyProgress } from "../../db/progress";
import { getDailyReviewStats } from "../../db/reviewQueue";
import { getStreak } from "../../db/streak";
import { colors, glow, gradients, layout, radius, spacing, type } from "../../theme";

export default function Inicio() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [streak, setStreak] = useState(null);
  const [inProgressDecks, setInProgressDecks] = useState([]);
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

      return () => {
        alive = false;
      };
    }, [])
  );

  const remaining = stats ? stats.remaining : null;
  const completedToday = stats && stats.total > 0 && stats.remaining === 0;

  if (!loaded) {
    return (
      <SectionSwipe index={0}>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={[styles.inner, styles.body]}>
          <Skeleton height={200} style={{ borderRadius: radius.lg }} />
          <Skeleton height={72} />
          <Skeleton height={72} />
          <Skeleton height={72} />
        </View>
      </SafeAreaView>
      </SectionSwipe>
    );
  }

  return (
    <SectionSwipe index={0}>
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.inner}>
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
            <Text style={styles.greeting}>¡Hola, Martín!</Text>
          </View>
        </Pressable>

        <View style={styles.streakRow}>
          <StreakFlame days={streak ? streak.days : null} active={!!streak && streak.activeToday} />
          <Text style={styles.streakLabel}>{streak && streak.days === 1 ? "día" : "días"}</Text>
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
            // alignSelf stretch: el hero tiene alignItems flex-start y sin
            // esto el track colapsa a 0 de ancho (la barra "desaparecía").
            <ProgressBar
              pct={stats.pct}
              gradient={gradients.bar}
              glowStyle={glow.cyan}
              style={{ marginTop: spacing.sm, alignSelf: "stretch" }}
            />
          ) : null}
          <Button
            label={completedToday ? "REPASAR DE NUEVO" : "REPASAR AHORA"}
            kind="inverse"
            onPress={() => router.push("/repaso")}
            style={{ marginTop: spacing.md, alignSelf: "center" }}
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
                <Feather name={d.icon || "book"} size={22} color={colors.accentText} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.deckName}>{d.name}</Text>
                  <ProgressBar
                    pct={d.progress.pct}
                    gradient={gradients.progress}
                    glowStyle={glow.green}
                    style={{ marginTop: 8 }}
                  />
                </View>
                <Text style={styles.deckPct}>{Math.round(d.progress.pct)}%</Text>
              </Card>
            ))}
          </View>
        ) : null}
      </ScrollView>
      </View>
    </SafeAreaView>
    </SectionSwipe>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
  },
  inner: {
    flex: 1,
    width: "100%",
    maxWidth: layout.maxWidth,
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
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
    marginTop: spacing.lg,
    borderRadius: radius.lg,
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
    gap: spacing.md,
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
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    ...glow.accentSoft,
  },
  deckName: {
    fontSize: 19,
    fontWeight: "600",
    color: colors.text,
  },
  deckPct: {
    color: colors.accentText,
    fontWeight: "700",
    fontSize: 15,
  },
});
