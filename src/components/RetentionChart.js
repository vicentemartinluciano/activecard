// Curva semanal de retención. SVG permite un área continua, una línea suave y
// puntos completos en los extremos sin depender de Views rotadas.

import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Line,
  Path,
  Stop,
} from "react-native-svg";

import { colors, font, tabular, type } from "../theme";

const MARGEN_X = 7;
const PLOT_H = 88;
const AXIS_H = 18;
const MIN_PCT = 50;
const MAX_PCT = 100;
const LINE_COLOR = "#4CC38A";
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function yOf(pct) {
  const clamped = Math.max(MIN_PCT, Math.min(MAX_PCT, pct));
  return PLOT_H - ((clamped - MIN_PCT) / (MAX_PCT - MIN_PCT)) * PLOT_H;
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
    const c1 = {
      x: p1.x + (p2.x - p0.x) / 6,
      y: Math.max(0, Math.min(PLOT_H, p1.y + (p2.y - p0.y) / 6)),
    };
    const c2 = {
      x: p2.x - (p3.x - p1.x) / 6,
      y: Math.max(0, Math.min(PLOT_H, p2.y - (p3.y - p1.y) / 6)),
    };
    path += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

export default function RetentionChart({ series, anchoBase = 0 }) {
  const [measured, setMeasured] = useState(0);
  const width = measured > 0 ? measured : Math.max(0, anchoBase - 24);
  const pointsWithData = (series || [])
    .map((item, index) => ({ ...item, index }))
    .filter((item) => item.pct != null);

  const count = series?.length || 0;
  const usefulWidth = Math.max(0, width - MARGEN_X * 2);
  const step = count > 1 && usefulWidth > 0 ? usefulWidth / (count - 1) : 0;
  const xOf = (index) => MARGEN_X + index * step;
  const points = pointsWithData.map((point) => ({
    ...point,
    x: xOf(point.index),
    y: yOf(point.pct),
  }));
  const linePath = smoothPath(points);
  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x} ${PLOT_H} L ${points[0].x} ${PLOT_H} Z`
      : "";
  const average =
    points.length > 0
      ? Math.round(points.reduce((sum, point) => sum + point.pct, 0) / points.length)
      : null;

  const labels = [];
  let lastMonth = null;
  (series || []).forEach((item, index) => {
    if (!item.weekStart) return;
    const month = Number(item.weekStart.slice(5, 7)) - 1;
    if (month !== lastMonth) {
      labels.push({ index, label: MESES[month] });
      lastMonth = month;
    }
  });

  return (
    <View>
      <View style={styles.wrap}>
        <View style={styles.axisY}>
          {[MAX_PCT, 75, MIN_PCT].map((value) => (
            <Text key={value} style={styles.axisLabel}>
              {value}
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
            <Svg width="100%" height={PLOT_H} style={StyleSheet.absoluteFill}>
              <Defs>
                <SvgLinearGradient id="retention-area" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="rgba(76,195,138,0.30)" />
                  <Stop offset="100%" stopColor="rgba(76,195,138,0)" />
                </SvgLinearGradient>
              </Defs>

              {[MAX_PCT, 75, MIN_PCT].map((value) => (
                <Line
                  key={value}
                  x1={0}
                  x2={width}
                  y1={yOf(value)}
                  y2={yOf(value)}
                  stroke={
                    value === MIN_PCT
                      ? "rgba(255,255,255,0.13)"
                      : "rgba(255,255,255,0.07)"
                  }
                  strokeWidth={1}
                />
              ))}

              {areaPath ? <Path d={areaPath} fill="url(#retention-area)" /> : null}
              {linePath ? (
                <Path
                  d={linePath}
                  fill="none"
                  stroke={LINE_COLOR}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {average != null ? (
                <Line
                  x1={0}
                  x2={width}
                  y1={yOf(average)}
                  y2={yOf(average)}
                  stroke="rgba(139,139,152,0.5)"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              ) : null}

              {points.map((point, index) => {
                const latest = index === points.length - 1;
                return (
                  <Circle
                    key={point.index}
                    cx={point.x}
                    cy={point.y}
                    r={latest ? 4 : 2.8}
                    fill={latest ? LINE_COLOR : colors.surfaceCard}
                    stroke={LINE_COLOR}
                    strokeWidth={latest ? 0 : 1.5}
                  />
                );
              })}
            </Svg>
          ) : null}

          {average != null ? (
            <Text style={[styles.averageLabel, { top: Math.max(0, yOf(average) - 7) }]}>
              prom. {average}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.axisX}>
        {width > 0
          ? labels.map((label) => (
              <Text
                key={label.index}
                style={[styles.axisLabel, styles.axisXLabel, { left: xOf(label.index) - 12 }]}
              >
                {label.label}
              </Text>
            ))
          : null}
      </View>

      {points.length === 0 ? (
        <Text style={[type.small, styles.empty]}>
          Todavía no hay repasos suficientes para dibujar la curva.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  axisY: {
    width: 24,
    height: PLOT_H,
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingRight: 5,
    marginTop: -5,
  },
  plot: {
    flex: 1,
    height: PLOT_H,
  },
  averageLabel: {
    position: "absolute",
    right: 0,
    fontSize: 8.5,
    ...font(600),
    ...tabular,
    color: colors.textMuted,
    backgroundColor: colors.surfaceCard,
    paddingHorizontal: 4,
  },
  axisX: {
    height: AXIS_H,
    marginLeft: 24,
  },
  axisLabel: {
    fontSize: 9,
    ...tabular,
    color: colors.textMuted,
  },
  axisXLabel: {
    position: "absolute",
    top: 4,
    width: 24,
    textAlign: "center",
  },
  empty: {
    textAlign: "center",
    marginTop: 4,
  },
});
