// "Lo que viene": un renglón por día con barra horizontal, el número exacto a
// la derecha y una rayita vertical marcando el tope diario. El día que se pasa
// del tope va en rojo.
//
// Formato elegido por Martín sobre la alternativa de barras verticales: ocupa
// más alto, pero el número de cada día se lee sin esfuerzo.
//
// FSRS ya sabe qué día vence cada tarjeta, así que ver el día cargado con
// anticipación te deja adelantar trabajo en vez de enterarte cuando lo tenés
// encima.

import { StyleSheet, Text, View } from "react-native";

import { colors, font, tabular, type } from "../theme";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export default function ForecastList({ forecast = [], limit }) {
  if (forecast.length === 0) return null;

  // La escala llega al máximo entre el día más cargado y el tope, para que la
  // rayita del tope siempre caiga dentro del riel.
  const maxCount = Math.max(...forecast.map((d) => d.count), limit || 0, 1);
  const capRatio = limit ? Math.min(1, limit / maxCount) : null;

  const excedido = limit ? forecast.find((d) => d.count > limit) : null;
  const total = forecast.reduce((a, d) => a + d.count, 0);

  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 7 }}>
        {forecast.map((d, i) => {
          const over = limit ? d.count > limit : false;
          const ratio = d.count / maxCount;
          return (
            <View key={d.day} style={styles.row}>
              {/* Día + número: "mié 30" ubica mucho mejor que solo el día
                  suelto cuando estás mirando la semana que viene. */}
              <Text style={[styles.dayLabel, i === 0 && styles.dayLabelHoy]}>
                {i === 0 ? "hoy" : `${DIAS[d.date.getDay()]} ${d.date.getDate()}`}
              </Text>
              <View style={styles.rail}>
                <View
                  style={[
                    styles.fill,
                    { width: `${Math.max(ratio * 100, d.count > 0 ? 4 : 0)}%` },
                    over && styles.fillOver,
                  ]}
                />
                {capRatio != null ? (
                  <View pointerEvents="none" style={[styles.cap, { left: `${capRatio * 100}%` }]} />
                ) : null}
              </View>
              <Text style={[styles.count, over && styles.countOver, d.count === 0 && styles.countCero]}>
                {d.count}
              </Text>
            </View>
          );
        })}
      </View>

      {total === 0 ? (
        // Siete ceros sin explicación se leen como "esto está roto".
        <Text style={type.small}>
          No hay nada agendado para los próximos días. Cuando estudies tarjetas nuevas van a
          empezar a aparecer acá.
        </Text>
      ) : limit ? (
        <Text style={type.small}>
          La rayita es tu tope de <Text style={styles.fuerte}>{limit}</Text>.
          {excedido ? (
            <Text>
              {" "}
              El <Text style={styles.alerta}>{DIAS[excedido.date.getDay()]}</Text> te pasás:
              conviene adelantar algunas hoy.
            </Text>
          ) : (
            <Text> La semana entra cómoda.</Text>
          )}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  dayLabel: {
    ...type.small,
    ...tabular,
    width: 46,
  },
  dayLabelHoy: {
    color: colors.text,
    ...font(700),
  },
  rail: {
    flex: 1,
    height: 16,
    borderRadius: 5,
    backgroundColor: "#FFFFFF08",
    overflow: "hidden",
    justifyContent: "center",
  },
  fill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: "#2F4699",
  },
  fillOver: {
    backgroundColor: colors.danger,
  },
  cap: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(233,233,239,0.45)",
  },
  count: {
    ...type.small,
    ...tabular,
    color: colors.text,
    width: 26,
    textAlign: "right",
  },
  countOver: {
    color: "#FF8A8E",
    ...font(700),
  },
  countCero: {
    color: colors.textMuted,
    opacity: 0.5,
  },
  fuerte: {
    color: colors.text,
    ...font(700),
    ...tabular,
  },
  alerta: {
    color: "#FF8A8E",
    ...font(700),
  },
});
