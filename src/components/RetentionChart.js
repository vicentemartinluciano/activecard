// Gráfico de retención por semana: área con degradé + línea + grilla + línea de
// promedio + puntos + meses en el eje X.
//
// POR QUÉ NO USA SVG: react-native-svg NO está instalado y es un módulo NATIVO
// — agregarlo obligaría a construir un APK nuevo y esta tanda entera va por
// OTA. Así que se dibuja con Views:
//   · el área son columnas verticales (una por semana) con LinearGradient;
//   · la línea son segmentos rotados con transformOrigin en el extremo izquierdo;
//   · grilla, promedio, puntos y etiquetas son Views/Text absolutos.
// Si algún día entra react-native-svg por otro motivo, esto se puede reescribir.

import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, font, tabular, type } from "../theme";

const PLOT_H = 88; // alto del área de dibujo
const AXIS_H = 18; // franja de las etiquetas de meses
const MIN_PCT = 50; // piso de la escala: abajo de 50% no hace falta detalle
const MAX_PCT = 100;

const LINE = "#4CC38A";

// % → coordenada Y dentro del plot (0 arriba).
function yOf(pct) {
  const clamped = Math.max(MIN_PCT, Math.min(MAX_PCT, pct));
  return PLOT_H - ((clamped - MIN_PCT) / (MAX_PCT - MIN_PCT)) * PLOT_H;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default function RetentionChart({ series }) {
  const [width, setWidth] = useState(0);

  // Solo las semanas con repasos: una semana sin datos no es 0% de retención,
  // es "no estudiaste" — dibujarla como cero sería mentir.
  const puntos = (series || [])
    .map((s, i) => ({ ...s, i }))
    .filter((s) => s.pct != null);

  const n = series ? series.length : 0;
  const step = n > 1 && width > 0 ? width / (n - 1) : 0;
  const xOf = (i) => i * step;

  const promedio =
    puntos.length > 0
      ? Math.round(puntos.reduce((a, p) => a + p.pct, 0) / puntos.length)
      : null;

  // Etiquetas de mes: la primera semana de cada mes que aparezca en la serie.
  const etiquetas = [];
  let ultimoMes = null;
  (series || []).forEach((s, i) => {
    if (!s.weekStart) return;
    const mes = Number(s.weekStart.slice(5, 7)) - 1;
    if (mes !== ultimoMes) {
      etiquetas.push({ i, label: MESES[mes] });
      ultimoMes = mes;
    }
  });

  return (
    <View>
      <View style={styles.wrap}>
        {/* Eje Y: las referencias van afuera del plot para no ensuciarlo. */}
        <View style={styles.axisY}>
          {[MAX_PCT, 75, MIN_PCT].map((v) => (
            <Text key={v} style={styles.axisLabel}>
              {v}
            </Text>
          ))}
        </View>

        <View style={styles.plot} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {/* Grilla */}
          {[MAX_PCT, 75, MIN_PCT].map((v) => (
            <View
              key={v}
              pointerEvents="none"
              style={[styles.grid, { top: yOf(v) }, v === MIN_PCT && styles.gridBase]}
            />
          ))}

          {width > 0 && puntos.length > 0 ? (
            <>
              {/* Área: una columna por semana con datos. Muchas columnas juntas
                  se leen como un área continua. */}
              {puntos.map((p) => {
                const y = yOf(p.pct);
                return (
                  <LinearGradient
                    key={`a${p.i}`}
                    colors={["rgba(76,195,138,0.26)", "rgba(76,195,138,0)"]}
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: xOf(p.i) - step / 2,
                      width: step || 1,
                      top: y,
                      height: PLOT_H - y,
                    }}
                  />
                );
              })}

              {/* Línea: un segmento rotado por par de puntos consecutivos. */}
              {puntos.slice(0, -1).map((p, k) => {
                const q = puntos[k + 1];
                const x1 = xOf(p.i);
                const y1 = yOf(p.pct);
                const dx = xOf(q.i) - x1;
                const dy = yOf(q.pct) - y1;
                const largo = Math.sqrt(dx * dx + dy * dy);
                const angulo = Math.atan2(dy, dx);
                return (
                  <View
                    key={`l${p.i}`}
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: x1,
                      top: y1 - 1,
                      width: largo,
                      height: 2,
                      borderRadius: 1,
                      backgroundColor: LINE,
                      transform: [{ rotate: `${angulo}rad` }],
                      transformOrigin: "left center",
                    }}
                  />
                );
              })}

              {/* Promedio */}
              {promedio != null ? (
                <View pointerEvents="none" style={[styles.avgLine, { top: yOf(promedio) }]}>
                  <Text style={styles.avgLabel}>prom. {promedio}</Text>
                </View>
              ) : null}

              {/* Puntos: el último resaltado, los demás discretos. */}
              {puntos.map((p, k) => {
                const ultimo = k === puntos.length - 1;
                const size = ultimo ? 8 : 5;
                return (
                  <View
                    key={`p${p.i}`}
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: xOf(p.i) - size / 2,
                      top: yOf(p.pct) - size / 2,
                      width: size,
                      height: size,
                      borderRadius: size / 2,
                      backgroundColor: ultimo ? LINE : colors.surfaceCard,
                      borderWidth: ultimo ? 0 : 1.5,
                      borderColor: LINE,
                    }}
                  />
                );
              })}
            </>
          ) : null}
        </View>
      </View>

      {/* Eje X */}
      <View style={styles.axisX}>
        {width > 0
          ? etiquetas.map((e) => (
              <Text key={e.i} style={[styles.axisLabel, styles.axisXLabel, { left: xOf(e.i) - 12 }]}>
                {e.label}
              </Text>
            ))
          : null}
      </View>

      {puntos.length === 0 ? (
        <Text style={[type.small, styles.vacio]}>
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
  grid: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  gridBase: {
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  avgLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(139,139,152,0.5)",
    alignItems: "flex-end",
  },
  avgLabel: {
    fontSize: 8.5,
    ...font(600),
    ...tabular,
    color: colors.textMuted,
    backgroundColor: colors.surfaceCard,
    paddingHorizontal: 4,
    transform: [{ translateY: -6 }],
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
  vacio: {
    textAlign: "center",
    marginTop: 4,
  },
});
