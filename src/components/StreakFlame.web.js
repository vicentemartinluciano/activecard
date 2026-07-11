// Fuego de racha del header de Inicio — versión web.
// lottie-react-native no es un módulo nativo confiable en web, así que acá
// se usa un ícono estático (misma info: activo/inactivo + días).

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

export default function StreakFlame({ days = null, active = false }) {
  const color = active ? colors.streak : colors.textMuted;
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name="fire" size={26} color={color} />
      {days != null ? <Text style={[styles.days, { color }]}>{days}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  days: {
    fontSize: 17,
    fontWeight: "700",
  },
});
