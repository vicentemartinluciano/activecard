import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect, useIsFocused, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import GlowPressable from "../../components/GlowPressable";
import ProgressBar from "../../components/ProgressBar";
import SectionSwipe from "../../components/SectionSwipe";
import Sheen from "../../components/Sheen";
import Skeleton from "../../components/Skeleton";
import Stagger from "../../components/Stagger";
import StreakFlame from "../../components/StreakFlame";
import Toast from "../../components/Toast";
import { Button, Card, Pill } from "../../components/ui";
import { listDecks } from "../../db/decks";
import { getDecksDailyProgress } from "../../db/progress";
import { getDailyReviewStats } from "../../db/reviewQueue";
import { getSetting } from "../../db/settings";
import { getStreak } from "../../db/streak";
import { colors, font, glow, gradients, layout, radius, spacing, tabular, type } from "../../theme";

// Saludo según la hora, para que Inicio no diga siempre lo mismo.
function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 6 || h >= 20) return "Buenas noches";
  if (h < 13) return "Buen día";
  return "Buenas tardes";
}

export default function Inicio() {
  const router = useRouter();
  const focused = useIsFocused();
  const [stats, setStats] = useState(null);
  const [streak, setStreak] = useState(null);
  const [inProgressDecks, setInProgressDecks] = useState([]);
  const [userName, setUserName] = useState("");
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false); // false solo hasta el primer fetch exitoso
  // El botón está DENTRO del hero y se queda con el press, así que el
  // contenedor no se entera: este estado le avisa para que se ilumine igual.
  const [ctaPressed, setCtaPressed] = useState(false);

  // Aparte del resto para poder reintentarla desde el aviso de error.
  const fetchStats = useCallback(async () => {
    try {
      const s = await getDailyReviewStats();
      setStats(s);
      setError(null);
    } catch (e) {
      console.warn("No se pudo leer la cola de repaso:", e);
      setStats(null);
      // Antes esto quedaba en silencio y la pantalla aparecía vacía sin decir
      // por qué. Ahora al menos se avisa y se puede reintentar.
      setError("No se pudo leer el repaso de hoy.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      getSetting("userName", "Martín")
        .then((n) => alive && setUserName(n))
        .catch(() => alive && setUserName("Martín"));

      fetchStats();

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
    }, [fetchStats])
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
            <Text style={styles.avatarInitial}>
              {(userName || "?").trim().charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.greeting}>
              {greeting()}, {userName}
            </Text>
          </View>
        </Pressable>

        <View style={styles.streakRow}>
          <StreakFlame days={streak ? streak.days : null} active={!!streak && streak.activeToday} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Stagger>
        {/* El hero: una luz gira por el borde de forma permanente (BorderLight)
            y el halo cobalto se enciende al tocar la tarjeta O al apretar el
            botón de adentro — de ahí el `active`, porque el press del botón no
            llega al contenedor. */}
        <GlowPressable
          onPress={() => router.push("/repaso")}
          style={styles.heroOuter}
          active={ctaPressed}
        >
          <LinearGradient
            colors={gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            {/* El reflejo va ENCIMA del degradé y debajo del texto: barre la
                superficie sin agregar ningún marco alrededor. */}
            <Sheen disabled={!focused} radius={radius.lg} />
            <Text style={styles.heroTitle}>Repaso de hoy</Text>
            {completedToday ? (
              <Text style={styles.heroDone}>Completado ✓</Text>
            ) : (
              // Tres pills en vez de una frase larga: se leen de un vistazo.
              // Sin borde marcado (Martín) — solo el fondo azul atenuado.
              <View style={styles.statRow}>
                <Pill
                  label={
                    <Text>
                      <Text style={styles.statValue}>{remaining != null ? remaining : "–"}</Text>{" "}
                      pendientes
                    </Text>
                  }
                  color={colors.accentText}
                  style={styles.statPill}
                />
                <Pill
                  label={
                    <Text>
                      <Text style={styles.statValue}>{stats ? stats.done : "–"}</Text> completadas
                    </Text>
                  }
                  color={colors.accentText}
                  style={styles.statPill}
                />
                <Pill
                  label={<Text style={styles.statValue}>{stats ? stats.pct : 0}%</Text>}
                  color={colors.accentText}
                  style={styles.statPill}
                />
              </View>
            )}
            {stats && stats.total > 0 ? (
              // alignSelf stretch: el hero tiene alignItems flex-start y sin
              // esto el track colapsa a 0 de ancho (la barra "desaparecía").
              <ProgressBar
                pct={stats.pct}
                gradient={gradients.bar}
                style={{ marginTop: spacing.sm, alignSelf: "stretch" }}
              />
            ) : null}
            <Button
              label={completedToday ? "REPASAR DE NUEVO" : "REPASAR AHORA"}
              kind="inverse"
              halo={glow.halo}
              onPress={() => router.push("/repaso")}
              onPressIn={() => setCtaPressed(true)}
              onPressOut={() => setCtaPressed(false)}
              style={styles.heroCta}
            />
          </LinearGradient>
        </GlowPressable>

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
        </Stagger>
      </ScrollView>
      </View>
      <Toast
        message={error}
        onRetry={() => {
          setError(null);
          fetchStats();
        }}
      />
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
    ...font(700),
    color: colors.text,
  },
  greeting: {
    fontSize: 18,
    ...font(700),
    color: colors.text,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  // El contenedor externo lleva el halo y NO recorta (overflow hidden se lo
  // comería); el degradé interno se redondea con su propio borderRadius.
  heroOuter: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
  },
  hero: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    overflow: "hidden",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  heroTitle: {
    fontSize: 26,
    ...font(800),
    color: colors.text,
  },
  statRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
    marginTop: 2,
  },
  // Mismo fondo que traía el pill "ACTIVE RECALL", pero SIN borde marcado.
  statPill: {
    backgroundColor: colors.accentSoft,
    borderColor: "transparent",
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  statValue: {
    color: "#FFFFFF",
    ...font(800),
    ...tabular,
    fontSize: 13,
  },
  heroCta: {
    marginTop: spacing.md,
    alignSelf: "center",
    // Punto medio entre el botón chico de antes y uno a todo el ancho.
    width: "74%",
  },
  heroDone: {
    fontSize: 26,
    ...font(700),
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
    ...font(600),
  },
  // Sin halo permanente: el color de las filas alcanza para distinguirlas.
  deckRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
  },
  deckName: {
    fontSize: 19,
    ...font(600),
    color: colors.text,
  },
  deckPct: {
    color: colors.accentText,
    ...font(700),
    fontSize: 15,
  },
});
