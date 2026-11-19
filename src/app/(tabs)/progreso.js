// Progreso: la respuesta a "¿cómo voy?".
// Todo lo que se ve acá sale de datos que la app ya venía guardando
// (review_logs y cards) — no hizo falta migración ni tabla nueva.
//
// Orden decidido con Martín: puntaje de recuerdo primero, constancia al
// deslizar la misma card, después la carga que
// viene y por último las tarjetas que se resisten.

import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import ActivityHeatmap from "../../components/ActivityHeatmap";
import ForecastList from "../../components/ForecastList";
import RecallScoreChart from "../../components/RecallScoreChart";
import MetricCarousel from "../../components/MetricCarousel";
import SectionSwipe from "../../components/SectionSwipe";
import Skeleton from "../../components/Skeleton";
import Stagger from "../../components/Stagger";
import { Button, Card, EmptyState, Pill, Screen } from "../../components/ui";
import { getDailyLimits } from "../../db/reviewQueue";
import {
  countWeakCards,
  getActivityMap,
  getForecast,
  getRecallScoreSeries,
  getRecallScoreSummary,
  listWeakCards,
} from "../../db/stats";
import { getStreak } from "../../db/streak";
import { toPlainText } from "../../lib/richtext";
import { colors, font, layout, spacing, tabular, type } from "../../theme";

const PAGINAS = ["Puntaje de recuerdo", "Constancia"];

export default function Progreso() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [pagina, setPagina] = useState(0);

  // El ancho de las páginas del carrusel se CALCULA, no se espera de onLayout:
  // si el layout no llega (pasa en entornos donde la vista no se compone), el
  // carrusel quedaría en blanco para siempre. onLayout sigue estando, pero solo
  // para corregir el valor, nunca para habilitar el render.
  const { width: anchoVentana } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && anchoVentana >= 1060;
  const anchoDisponible =
    Math.min(anchoVentana, layout.maxWidth) - spacing.md * 2 - spacing.md * 2;
  const [anchoMedido, setAnchoMedido] = useState(0);
  const [anchoChartDesktop, setAnchoChartDesktop] = useState(0);
  const anchoCard = anchoMedido > 0 ? anchoMedido : Math.max(0, anchoDisponible);
  const setAnchoCard = setAnchoMedido;
  const metricWidth = anchoCard;

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all([
        getRecallScoreSummary(),
        getRecallScoreSeries(12),
        getActivityMap(84),
        getForecast(7),
        listWeakCards(3),
        countWeakCards(),
        getStreak(),
        getDailyLimits(),
      ])
        .then(([resumen, serie, actividad, forecast, debiles, totalDebiles, racha, limits]) => {
          if (!alive) return;
          setData({ resumen, serie, actividad, forecast, debiles, totalDebiles, racha, limits });
        })
        .catch((e) => {
          console.warn("No se pudieron leer las estadísticas:", e);
          if (alive) setData({ error: true });
        });
      return () => {
        alive = false;
      };
    }, [])
  );

  if (!data) {
    return (
      <SectionSwipe index={4}>
        <Screen safeTop>
          <Skeleton height={40} />
          <View style={{ gap: spacing.md, marginTop: spacing.md }}>
            <Skeleton height={190} />
            <Skeleton height={190} />
            <Skeleton height={150} />
          </View>
        </Screen>
      </SectionSwipe>
    );
  }

  if (data.error) {
    return (
      <SectionSwipe index={4}>
        <Screen safeTop>
          <EmptyState
            full
            icon="bar-chart-2"
            text={"No se pudieron leer tus estadísticas.\nProbá volver a entrar."}
          />
        </Screen>
      </SectionSwipe>
    );
  }

  const { resumen, serie, actividad, forecast, debiles, totalDebiles, racha, limits } = data;
  const sinDatos = resumen.score == null;
  const desktopChartWidth = anchoChartDesktop > 0
    ? Math.max(240, anchoChartDesktop - spacing.md * 2)
    : Math.max(320, Math.floor((anchoVentana - 200) / 2));

  const renderRecallBody = (chartWidth) => (
    <>
      <View style={styles.rowHead}>
        <Text style={type.label}>Puntaje de recuerdo</Text>
        {resumen.delta != null ? (
          <Pill
            icon={resumen.delta >= 0 ? "trending-up" : "trending-down"}
            label={`${resumen.delta >= 0 ? "+" : ""}${resumen.delta} pts`}
            color={resumen.delta >= 0 ? colors.successBright : colors.danger}
          />
        ) : null}
      </View>
      <View
        style={styles.bigRow}
        accessible
        accessibilityLabel={sinDatos
          ? "Todavía no hay repasos en los últimos 30 días."
          : `Puntaje de recuerdo ponderado: ${resumen.score}%. Últimos 30 días.${resumen.delta != null ? ` Diferencia respecto de los 30 días anteriores: ${resumen.delta} puntos porcentuales.` : ""}`}
      >
        <Text style={styles.bigNum}>
          {sinDatos ? "–" : resumen.score}
          <Text style={styles.bigUnit}>%</Text>
        </Text>
        <Text style={type.small}>últimos 30 días</Text>
      </View>
      <Text style={type.small}>Evolución de las últimas 12 semanas</Text>
      <RecallScoreChart series={serie} anchoBase={chartWidth} />
    </>
  );

  const renderConstancyBody = () => (
    <>
      <View style={styles.rowHead}>
        <Text style={type.label}>Constancia</Text>
        {racha && racha.days > 0 ? (
          <Pill
            icon="zap"
            label={`${racha.days} ${racha.days === 1 ? "día" : "días"}`}
            color={colors.streak}
          />
        ) : null}
      </View>
      <Text style={type.small}>Últimos 84 días</Text>
      <ActivityHeatmap activity={actividad} />
    </>
  );

  const forecastCard = (cardStyle) => (
    <Card style={[{ gap: spacing.md }, cardStyle]}>
      <View style={styles.rowHead}>
        <Text style={type.label}>Lo que viene</Text>
        <Pill icon="calendar" label="7 días" />
      </View>
      <ForecastList forecast={forecast} limit={limits.maxReviews} newLimit={limits.maxNew} />
    </Card>
  );

  const weakCard = (cardStyle) => (
    <Card style={[{ gap: spacing.sm }, cardStyle]}>
      <View style={styles.rowHead}>
        <Text style={type.label}>Puntos débiles</Text>
        {totalDebiles > 0 ? (
          <Pill
            label={`${totalDebiles} ${totalDebiles === 1 ? "tarjeta" : "tarjetas"}`}
            color={colors.danger}
          />
        ) : null}
      </View>

      {debiles.length === 0 ? (
        <Text style={type.small}>
          Todavía no fallaste ninguna tarjeta lo suficiente como para que aparezca acá.
        </Text>
      ) : (
        <>
          {debiles.map((c) => (
            <View key={c.id} style={styles.weakRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Abrir tarjeta ${toPlainText(c.front)}`}
                onPress={() => router.push(`/mazos/${c.deck_id}/tarjeta?cardId=${c.id}`)}
                style={({ pressed }) => [styles.weakOpen, pressed && { opacity: 0.7 }]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.weakText} numberOfLines={2}>
                    {toPlainText(c.front)}
                  </Text>
                  <Text style={styles.weakCount} numberOfLines={1}>
                    {c.deck_name ? `${c.deck_name} · ` : ""}
                    {c.lapses} {c.lapses === 1 ? "fallo" : "fallos"}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Reformular en Gimnasio ${toPlainText(c.front)}`}
                hitSlop={6}
                onPress={() => router.push(`/gimnasio/chat?cardId=${c.id}`)}
                style={({ pressed }) => [styles.weakGymBtn, pressed && { opacity: 0.7 }]}
              >
                <Feather name="zap" size={16} color="#C9A8FF" />
              </Pressable>
            </View>
          ))}
          <Button
            label="ESTUDIAR MIS PUNTOS DÉBILES"
            kind="primary"
            onPress={() => router.push("/mazos/debiles/estudiar")}
            style={{ marginTop: spacing.sm }}
          />
        </>
      )}
    </Card>
  );

  return (
    <SectionSwipe index={4}>
      <Screen safeTop style={Platform.OS === 'web' ? { maxWidth: '100%', paddingHorizontal: 32 } : undefined}>
        <View style={styles.appbar}>
          <Text style={styles.titulo}>Progreso</Text>
        </View>

        <ScrollView
          contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md, paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
          {isDesktop ? (
            <Stagger>
              <View style={styles.desktopGrid}>
                <Card
                  style={[styles.gridCard, { gap: spacing.sm }]}
                  onLayout={(e) => {
                    const w = Math.floor(e.nativeEvent.layout.width);
                    if (w > 0 && w !== anchoChartDesktop) setAnchoChartDesktop(w);
                  }}
                >
                  {renderRecallBody(desktopChartWidth)}
                </Card>
                <Card style={[styles.gridCard, { gap: spacing.sm }]}>
                  {renderConstancyBody()}
                </Card>
                {forecastCard(styles.gridCard)}
                {weakCard(styles.gridCard)}
              </View>
            </Stagger>
          ) : (
            <Stagger>
              {/* Puntaje y constancia comparten card: se deslizan de costado.
                  Así el gráfico tiene lugar para respirar sin comerse la pantalla. */}
              <Card>
                {/* El ancho se mide ACÁ y las páginas no se dibujan hasta tenerlo.
                    Antes se renderizaban con ancho automático y cada una se
                    desbordaba sobre la otra: se veía el gráfico de recuerdo
                    encima de la constancia. Cada página además recorta lo suyo. */}
                <View
                  style={styles.carruselMedida}
                  onLayout={(e) => {
                    const w = Platform.OS === 'web' ? Math.floor(e.nativeEvent.layout.width) : Math.round(e.nativeEvent.layout.width);
                    if (w > 0) setAnchoCard(w);
                  }}
                >
                  {anchoCard > 0 ? (
                    <MetricCarousel
                      pageWidth={metricWidth}
                      page={pagina}
                      onPageChange={setPagina}
                    >
                      <View style={[styles.pagina, { width: metricWidth }]}>
                        {renderRecallBody(metricWidth)}
                      </View>

                      <View style={[styles.pagina, { width: metricWidth }]}>
                        {renderConstancyBody()}
                      </View>
                    </MetricCarousel>
                  ) : null}
                </View>

                {Platform.OS === 'web' ? (
                  <View style={styles.webSegmentWrap}>
                    <View style={styles.webSegment}>
                      {PAGINAS.map((label, index) => (
                        <Pressable
                          key={label}
                          accessibilityRole="button"
                          accessibilityState={{ selected: pagina === index }}
                          onPress={() => setPagina(index)}
                          style={({ hovered }) => [
                            styles.webSegmentBtn,
                            pagina === index && styles.webSegmentBtnActive,
                            hovered && pagina !== index && { backgroundColor: colors.surfaceHigh },
                          ]}
                        >
                          <Text style={[styles.webSegmentLabel, pagina === index && styles.webSegmentLabelActive]}>
                            {label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : <View style={styles.dots}>
                  {PAGINAS.map((p, i) => (
                    <View key={p} style={[styles.dot, i === pagina && styles.dotOn]} />
                  ))}
                </View>}
              </Card>

              {forecastCard()}
              {weakCard()}
            </Stagger>
          )}
        </ScrollView>
      </Screen>
    </SectionSwipe>
  );
}

const styles = StyleSheet.create({
  appbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titulo: {
    ...type.title,
  },
  desktopGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    alignItems: "stretch",
  },
  gridCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "46%",
    minWidth: 380,
  },
  rowHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // El contenedor que mide: sin alto propio, lo pone el contenido de la página.
  carruselMedida: {
    width: "100%",
  },
  pagina: {
    gap: spacing.sm,
    // Recorta lo suyo: si una página se pasa, no invade la de al lado.
    overflow: "hidden",
  },
  bigRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  bigNum: {
    fontSize: 42,
    ...font(800),
    ...tabular,
    color: colors.successBright,
    letterSpacing: -1.2,
  },
  bigUnit: {
    fontSize: 18,
    ...font(700),
    // El porcentaje forma parte de la cifra.
    color: colors.successBright,
  },
  webSegmentWrap: {
    alignItems: "center",
    marginTop: 18,
  },
  webSegment: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  webSegmentBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  webSegmentBtnActive: {
    backgroundColor: "rgba(70,104,232,0.2)",
  },
  webSegmentLabel: {
    ...font(500),
    fontSize: 13.5,
    color: colors.textMuted,
  },
  webSegmentLabelActive: {
    ...font(600),
    color: colors.accentText,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    marginTop: spacing.sm,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#FFFFFF24",
  },
  dotOn: {
    width: 14,
    backgroundColor: colors.accentText,
  },
  weakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  weakOpen: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  weakGymBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(158,110,222,0.12)",
    borderWidth: 1,
    borderColor: "rgba(158,110,222,0.32)",
  },
  weakText: {
    ...type.small,
    color: colors.text,
    lineHeight: 21,
  },
  weakCount: {
    ...type.small,
    ...tabular,
    color: colors.danger,
    ...font(700),
  },
});
