// Mapa de constancia: 12 columnas (semanas) × 7 filas (días), como el de
// GitHub. Muestra los últimos 84 días tal cual fueron — un hueco es un hueco.
//
// Convive con la racha a propósito: la racha castiga (perdés un día y volvés a
// cero) justo cuando más importa no abandonar. Acá el hueco no borra el resto.

import { StyleSheet, Text, View } from "react-native";

import { localDayKey } from "../db/stats";
import { colors, font, tabular, type } from "../theme";

const SEMANAS = 12;
const DIAS = SEMANAS * 7;

// Cinco niveles: sin actividad + cuatro intensidades.
const NIVELES = ["#FFFFFF0D", "#1E3A6B", "#2B54A8", "#3E63DD", "#7FA0FF"];

function nivelDe(n) {
  if (!n) return 0;
  if (n < 5) return 1;
  if (n < 15) return 2;
  if (n < 30) return 3;
  return 4;
}

export default function ActivityHeatmap({ activity = {}, now = new Date() }) {
  // Arranca 83 días atrás para que HOY quede en la última celda.
  const hoy = new Date(now);
  hoy.setHours(0, 0, 0, 0);

  const celdas = Array.from({ length: DIAS }, (_, i) => {
    const d = new Date(hoy);
    d.setDate(d.getDate() - (DIAS - 1 - i));
    const key = localDayKey(d);
    return { key, count: activity[key] || 0 };
  });

  const conActividad = celdas.filter((c) => c.count > 0).length;

  // El grid se arma por COLUMNA (una columna = una semana), no por fila.
  const columnas = Array.from({ length: SEMANAS }, (_, w) => celdas.slice(w * 7, w * 7 + 7));

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.grid}>
        {columnas.map((semana, w) => (
          <View key={w} style={styles.col}>
            {semana.map((c) => (
              <View key={c.key} style={[styles.cell, { backgroundColor: NIVELES[nivelDe(c.count)] }]} />
            ))}
          </View>
        ))}
      </View>

      <View style={styles.legend}>
        <Text style={[type.small, { flex: 1 }]}>
          Estudiaste <Text style={styles.fuerte}>{conActividad}</Text> de los últimos{" "}
          <Text style={styles.fuerte}>{DIAS}</Text> días
        </Text>
        <Text style={styles.legendSign}>–</Text>
        {NIVELES.map((c) => (
          <View key={c} style={[styles.legendCell, { backgroundColor: c }]} />
        ))}
        <Text style={styles.legendSign}>+</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    gap: 3,
  },
  col: {
    flex: 1,
    gap: 3,
  },
  cell: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 2.5,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendCell: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendSign: {
    ...type.small,
    fontSize: 10,
  },
  fuerte: {
    color: colors.text,
    ...font(700),
    ...tabular,
  },
});
