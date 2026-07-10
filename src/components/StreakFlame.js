// Fuego de racha del header de Inicio.
// F9: versión estática (ícono + días). En F11 se conecta a la racha real
// y en nativo se reemplaza por la animación Lottie del usuario.

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

export default function StreakFlame({ days = null, dimmed = true }) {
  const color = dimmed ? colors.textMuted : colors.streak;
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
