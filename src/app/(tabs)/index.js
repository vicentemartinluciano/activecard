import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect, useIsFocused, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
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
import { homeDecks } from "../../lib/homeDecks";
import { colors, font, glow, gradients, layout, radius, spacing, tabular, textColors, type } from "../../theme";

// Saludo según la hora, para que Inicio no diga siempre lo mismo.
function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 6 || h >= 20) return "Buenas noches";
  if (h < 13) return "Buen día";
  return "Buenas tardes";
}

function HomeDeckArea({ children }) {
  return Platform.OS === 'web'
    ? <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 24 }}>{children}</ScrollView>
    : <View style={{ gap: 28 }}>{children}</View>;
}

export default function Inicio() {
  const router = useRouter();
  const focused = useIsFocused();
  const { height: windowHeight } = useWindowDimensions();
  const workspaceHeight = Math.max(380, windowHeight - 124);
  const [stats, setStats] = useState(null);
  const [streak, setStreak] = useState(null);
  const [inProgressDecks, setInProgressDecks] = useState([]);
  const [recentDecks, setRecentDecks] = useState([]);
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
            .filter((d) => d.progress && d.progress.pct > 0 && d.progress.pct < 100);
          setInProgressDecks(Platform.OS === 'web' ? withProgress : withProgress.slice(0, 3));
          setRecentDecks([...decks].sort((a, b) => String(b.last_studied_at || b.created_at).localeCompare(String(a.last_studied_at || a.created_at)) || b.id - a.id).slice(0, 3));
        })
        .catch(() => { if (alive) { setInProgressDecks([]); setRecentDecks([]); } });

      return () => {
        alive = false;
      };
    }, [fetchStats])
  );

  const remaining = stats ? stats.remaining : null;
  const completedToday = stats && stats.total > 0 && stats.remaining === 0;
  const visibleRecent = homeDecks(inProgressDecks, recentDecks, workspaceHeight);

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
          {Platform.OS !== 'web' && <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir Gimnasio Mental"
            hitSlop={8}
            onPress={() => router.push("/gimnasio/chat")}
            style={({ pressed }) => [styles.gymShortcut, pressed && { opacity: 0.7 }]}
          >
            <Feather name="zap" size={20} color={textColors.violeta} />
          </Pressable>}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={Platform.OS === 'web' ? { flexDirection: 'row', flexWrap: 'wrap', gap: 28, paddingTop: 24 } : undefined}>
        <Stagger style={Platform.OS === 'web' ? { flexGrow: 1, flexShrink: 1, flexBasis: 460, minWidth: 0, height: workspaceHeight } : undefined}>
        <View style={Platform.OS === 'web' ? { flex: 1 } : undefined}>
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
                  labelStyle={styles.statLabel}
                />
                <Pill
                  label={
                    <Text>
                      <Text style={styles.statValue}>{stats ? stats.done : "–"}</Text> completadas
                    </Text>
                  }
                  color={colors.accentText}
                  style={styles.statPill}
                  labelStyle={styles.statLabel}
                />
                <Pill
                  label={<Text style={styles.statValue}>{stats ? stats.pct : 0}%</Text>}
                  color={colors.accentText}
                  style={styles.statPill}
                  labelStyle={styles.statLabel}
                />
              </View>
            )}
            {stats && stats.total > 0 ? (
              // alignSelf stretch: el hero tiene alignItems flex-start y sin
              // esto el track colapsa a 0 de ancho (la barra "desaparecía").
              <ProgressBar
                pct={stats.pct}
                gradient={gradients.bar}
                style={{ marginTop: spacing.sm, alignSelf: "stretch", ...(Platform.OS === 'web' ? { height: 14 } : {}) }}
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
              size={Platform.OS === 'web' ? 'lg' : undefined}
            />
          </LinearGradient>
        </GlowPressable>
        </View>
        <HomeDeckArea>
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
        {Platform.OS === 'web' && visibleRecent.length > 0 && <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={type.label}>MAZOS RECIENTES</Text><Pressable accessibilityRole="button" onPress={() => router.push('/biblioteca')}><Text style={styles.sectionLink}>Ver todos</Text></Pressable></View>
          {visibleRecent.map((deck) => <Card key={deck.id} onPress={() => router.push(`/mazos/${deck.id}`)} style={styles.deckRow}>
            <Feather name={deck.icon || 'layers'} size={24} color={colors.accentText} /><View style={{ flex: 1 }}><Text style={styles.deckName}>{deck.name}</Text><Text style={type.small}>{deck.card_count} tarjetas</Text></View><Feather name="chevron-right" size={18} color={colors.textMuted} />
          </Card>)}
        </View>}
        </HomeDeckArea>
        </Stagger>
        </View>
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
    gap: spacing.sm,
  },
  gymShortcut: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
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
    ...(Platform.OS === 'web' ? { marginTop: 0, flex: 1 } : {}),
  },
  hero: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    overflow: "hidden",
    gap: spacing.sm,
    alignItems: "flex-start",
    ...(Platform.OS === 'web' ? { flex: 1, minHeight: 380, padding: 32, justifyContent: 'center', gap: 24 } : {}),
  },
  heroTitle: {
    fontSize: 26,
    ...font(800),
    color: colors.text,
    ...(Platform.OS === 'web' ? { fontSize: 36, lineHeight: 46 } : {}),
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
    ...(Platform.OS === 'web' ? { paddingVertical: 9, paddingHorizontal: 16 } : {}),
  },
  statLabel: Platform.OS === 'web' ? { fontSize: 16, lineHeight: 24 } : {},
  statValue: {
    color: "#FFFFFF",
    ...font(800),
    ...tabular,
    fontSize: 13,
    ...(Platform.OS === 'web' ? { fontSize: 18 } : {}),
  },
  heroCta: {
    marginTop: spacing.md,
    alignSelf: "center",
    // Punto medio entre el botón chico de antes y uno a todo el ancho.
    width: "74%",
    ...(Platform.OS === 'web' ? { width: '100%', minHeight: 60 } : {}),
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
    ...(Platform.OS === 'web' ? { minHeight: 96, paddingVertical: 18 } : {}),
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
