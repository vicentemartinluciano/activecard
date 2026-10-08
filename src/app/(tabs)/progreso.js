// Progreso: la respuesta a "¿cómo voy?".
// Todo lo que se ve acá sale de datos que la app ya venía guardando
// (review_logs y cards) — no hizo falta migración ni tabla nueva.
//
// Orden decidido con Martín: puntaje de recuerdo primero, constancia al
// deslizar la misma card, después la carga que
// viene y por último las tarjetas que se resisten.

import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import ActivityHeatmap from "../../components/ActivityHeatmap";
import ForecastList from "../../components/ForecastList";
import RecallScoreChart from "../../components/RecallScoreChart";
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

function MetricPages({ children, ...props }) {
  return Platform.OS === 'web' ? <View style={{ gap: 32, width: '100%' }}>{children}</View> : <ScrollView {...props}>{children}</ScrollView>;
}

export default function Progreso() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [pagina, setPagina] = useState(0);

  // El ancho de las páginas del carrusel se CALCULA, no se espera de onLayout:
  // si el layout no llega (pasa en entornos donde la vista no se compone), el
  // carrusel quedaría en blanco para siempre. onLayout sigue estando, pero solo
  // para corregir el valor, nunca para habilitar el render.
  const { width: anchoVentana } = useWindowDimensions();
  const anchoDisponible =
    Math.min(anchoVentana, layout.maxWidth) - spacing.md * 2 - spacing.md * 2;
  const [anchoMedido, setAnchoMedido] = useState(0);
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
      <SectionSwipe index={3}>
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
      <SectionSwipe index={3}>
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

  return (
    <SectionSwipe index={3}>
      <Screen safeTop>
        <View style={styles.appbar}>
          <Text style={styles.titulo}>Progreso</Text>
          <Pill label="Últimos 3 meses" />
        </View>

        <ScrollView
          contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md, paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
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
                  <MetricPages
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={(e) => {
                      const w = e.nativeEvent.layoutMeasurement.width;
                      if (w > 0) setPagina(Math.round(e.nativeEvent.contentOffset.x / w));
                    }}
                    scrollEventThrottle={32}
                  >
                    <View style={[styles.pagina, { width: metricWidth }]}>
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
                      <RecallScoreChart series={serie} anchoBase={metricWidth} />
                    </View>

                    <View style={[styles.pagina, { width: metricWidth }]}>
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
                      <ActivityHeatmap activity={actividad} />
                    </View>
                  </MetricPages>
                ) : null}
              </View>

              <View style={[styles.dots, Platform.OS === 'web' && { display: 'none' }]}>
                {PAGINAS.map((p, i) => (
                  <View key={p} style={[styles.dot, i === pagina && styles.dotOn]} />
                ))}
              </View>
            </Card>

            <Card style={{ gap: spacing.md }}>
              <View style={styles.rowHead}>
                <Text style={type.label}>Lo que viene</Text>
                <Pill icon="calendar" label="7 días" />
              </View>
              <ForecastList forecast={forecast} limit={limits.maxReviews} />
            </Card>

            <Card style={{ gap: spacing.sm }}>
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
                      <Text style={styles.weakText} numberOfLines={2}>
                        {toPlainText(c.front)}
                      </Text>
                      <Text style={styles.weakCount}>
                        {c.lapses} {c.lapses === 1 ? "fallo" : "fallos"}
                      </Text>
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
          </Stagger>
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
    fontSize: 24,
    ...font(800),
    color: colors.text,
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
    fontSize: 38,
    ...font(800),
    ...tabular,
    color: colors.successBright,
    letterSpacing: -1,
  },
  bigUnit: {
    fontSize: 17,
    ...font(700),
    // El porcentaje forma parte de la cifra.
    color: colors.successBright,
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
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  weakText: {
    ...type.small,
    color: colors.text,
    flex: 1,
    lineHeight: 18,
  },
  weakCount: {
    ...type.small,
    ...tabular,
    color: colors.danger,
    ...font(700),
  },
});
