// Curva semanal del puntaje de recuerdo, con referencias fuera del trazado.
import { useId, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Line,
  Path,
  Stop,
} from "react-native-svg";

import { EmptyState } from "./ui";
import { colors, font, gradients, spacing, tabular } from "../theme";

const MARGEN_X = 10;
const MARGEN_Y = 12;
const PLOT_H = Platform.OS === 'web' ? 260 : 144;
const AXIS_W = Platform.OS === 'web' ? 48 : 36;
const BASE_Y = PLOT_H - MARGEN_Y;
const LINE_COLOR = gradients.progress[1];
const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

// Abre la escala cuando hace falta: un puntaje menor a 50 no debe parecer 50.
export function recallScoreScale(series = []) {
  const min = series.some((item) => item.score != null && item.score < 50)
    ? 0
    : 50;
  return {
    ticks: [100, (100 + min) / 2, min],
    yOf: (score) =>
      BASE_Y -
      ((Math.max(min, Math.min(100, score)) - min) / (100 - min)) *
        (PLOT_H - MARGEN_Y * 2),
  };
}

export function smoothPath(points) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    // La curva no inventa picos entre dos valores semanales.
    const clampY = (y) =>
      Math.max(Math.min(p1.y, p2.y), Math.min(Math.max(p1.y, p2.y), y));
    const c1 = {
      x: p1.x + (p2.x - p0.x) / 6,
      y: clampY(p1.y + (p2.y - p0.y) / 6),
    };
    const c2 = {
      x: p2.x - (p3.x - p1.x) / 6,
      y: clampY(p2.y - (p3.y - p1.y) / 6),
    };
    path += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

export default function RecallScoreChart({ series = [], anchoBase = 0 }) {
  const [measured, setMeasured] = useState(0);
  const gradientId = useId().replace(/:/g, "");
  const areaId = `recall-score-area-${gradientId}`;
  const lineId = `recall-score-line-${gradientId}`;
  const width = measured > 0 ? measured : Math.max(0, anchoBase - AXIS_W);
  const pointsWithData = series
    .map((item, index) => ({ ...item, index }))
    .filter((item) => item.score != null);
  const { ticks, yOf } = recallScoreScale(series);
  const usefulWidth = Math.max(0, width - MARGEN_X * 2);
  const step = series.length > 1 ? usefulWidth / (series.length - 1) : 0;
  const xOf = (index) =>
    series.length === 1 ? width / 2 : MARGEN_X + index * step;
  const points = pointsWithData.map((point) => ({
    ...point,
    x: xOf(point.index),
    y: yOf(point.score),
  }));
  const latest = points[points.length - 1];
  const linePath = smoothPath(points);
  const areaPath =
    points.length > 1
      ? `${linePath} L ${latest.x} ${BASE_Y} L ${points[0].x} ${BASE_Y} Z`
      : "";
  const average =
    points.length > 0
      ? Math.round(
          points.reduce((sum, point) => sum + point.score, 0) / points.length,
        )
      : null;

  const labels = [];
  let lastMonth = null;
  series.forEach((item, index) => {
    if (!item.weekStart) return;
    const month = Number(item.weekStart.slice(5, 7)) - 1;
    if (month !== lastMonth) {
      labels.push({ index, label: MESES[month] });
      lastMonth = month;
    }
  });

  if (!latest) {
    return (
      <EmptyState
        icon="activity"
        text={
          "Tus repasos van a dibujar esta curva.\nCada semana vas a poder ver cómo evoluciona tu puntaje de recuerdo."
        }
      />
    );
  }

  return (
    <View
      style={styles.chart}
      accessible
      accessibilityLabel={`Puntaje de recuerdo ponderado por semana. Última semana con repasos: ${latest.score}%. Promedio de las semanas con repasos: ${average}%. Escala de ${ticks[2]} a 100%.`}
    >
      <Text style={styles.caption}>Por semana · 12 semanas</Text>
      <View style={styles.wrap}>
        <View style={styles.axisY}>
          {ticks.map((value) => (
            <Text
              key={value}
              style={[
                styles.axisLabel,
                styles.axisYLabel,
                { top: yOf(value) - 7 },
              ]}
            >
              {value}%
            </Text>
          ))}
        </View>
        <View
          style={styles.plot}
          onLayout={(event) => {
            const nextWidth = event.nativeEvent.layout.width;
            if (nextWidth > 0 && nextWidth !== measured) setMeasured(nextWidth);
          }}
        >
          {width > 0 ? (
            <Svg
              width="100%"
              height={PLOT_H}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              <Defs>
                <SvgLinearGradient
                  id={areaId}
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <Stop
                    offset="0%"
                    stopColor={colors.successBright}
                    stopOpacity={0.28}
                  />
                  <Stop
                    offset="65%"
                    stopColor={colors.successBright}
                    stopOpacity={0.08}
                  />
                  <Stop
                    offset="100%"
                    stopColor={colors.successBright}
                    stopOpacity={0}
                  />
                </SvgLinearGradient>
                <SvgLinearGradient
                  id={lineId}
                  gradientUnits="userSpaceOnUse"
                  x1={MARGEN_X}
                  y1={0}
                  x2={width - MARGEN_X}
                  y2={0}
                >
                  <Stop offset="0%" stopColor={gradients.progress[0]} />
                  <Stop offset="100%" stopColor={LINE_COLOR} />
                </SvgLinearGradient>
              </Defs>
              {ticks.map((value) => (
                <Line
                  key={value}
                  x1={MARGEN_X}
                  x2={width - MARGEN_X}
                  y1={yOf(value)}
                  y2={yOf(value)}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={1}
                  strokeDasharray={value === ticks[2] ? undefined : "2 5"}
                />
              ))}
              {areaPath ? <Path d={areaPath} fill={`url(#${areaId})`} /> : null}
              <Line
                x1={MARGEN_X}
                x2={width - MARGEN_X}
                y1={yOf(average)}
                y2={yOf(average)}
                stroke={colors.textMuted}
                strokeOpacity={0.55}
                strokeWidth={1}
                strokeDasharray="5 5"
              />
              <Line
                x1={latest.x}
                x2={latest.x}
                y1={latest.y}
                y2={BASE_Y}
                stroke={LINE_COLOR}
                strokeOpacity={0.25}
                strokeDasharray="3 5"
              />
              <Path
                d={linePath}
                fill="none"
                stroke={`url(#${lineId})`}
                strokeWidth={2.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.slice(0, -1).map((point) => (
                <Circle
                  key={point.index}
                  cx={point.x}
                  cy={point.y}
                  r={2.5}
                  fill={colors.surfaceCard}
                  stroke={colors.successBright}
                  strokeWidth={1.5}
                />
              ))}
              <Circle
                cx={latest.x}
                cy={latest.y}
                r={7}
                fill={colors.surfaceCard}
                stroke={LINE_COLOR}
                strokeWidth={1}
              />
              <Circle cx={latest.x} cy={latest.y} r={3.5} fill={LINE_COLOR} />
            </Svg>
          ) : null}
        </View>
      </View>
      <View style={styles.axisX}>
        {width > 0
          ? labels.map((label) => (
              <Text
                key={label.index}
                style={[
                  styles.axisLabel,
                  styles.axisXLabel,
                  {
                    left: Math.max(
                      0,
                      Math.min(width - 28, xOf(label.index) - 14),
                    ),
                  },
                ]}
              >
                {label.label}
              </Text>
            ))
          : null}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.legendDash} />
          <Text style={styles.legendText}>
            Promedio semanal <Text style={styles.averageValue}>{average}%</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { paddingTop: spacing.xs, gap: spacing.xs },
  caption: {
    fontSize: Platform.OS === 'web' ? 14 : 11,
    ...font(500),
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  wrap: { flexDirection: "row" },
  axisY: { width: AXIS_W, height: PLOT_H },
  axisYLabel: { position: "absolute", right: 6 },
  plot: { flex: 1, height: PLOT_H },
  axisX: { height: 22, marginLeft: AXIS_W },
  axisLabel: {
    fontSize: Platform.OS === 'web' ? 12 : 10,
    lineHeight: 14,
    ...font(500),
    ...tabular,
    color: colors.textMuted,
  },
  axisXLabel: { position: "absolute", width: 28, textAlign: "center" },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    columnGap: spacing.md,
    rowGap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDash: {
    width: 10,
    borderTopWidth: 1,
    borderColor: colors.textMuted,
    borderStyle: "dashed",
  },
  legendText: {
    fontSize: Platform.OS === 'web' ? 14 : 12,
    lineHeight: 18,
    ...font(400),
    color: colors.textMuted,
  },
  averageValue: { ...font(600), ...tabular, color: colors.text },
});
