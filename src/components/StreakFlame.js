// Fuego de racha del header de Inicio — versión nativa (Android/iOS).
// Anima la animación Lottie del usuario cuando la racha está activa hoy.
// La versión web vive en StreakFlame.web.js (Metro resuelve por extensión de
// plataforma, así el bundle web nunca intenta cargar lottie-react-native).

import { MaterialCommunityIcons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

const streakAnimation = require("../../assets/lottie/streak-fire.json");

export default function StreakFlame({ days = null, active = false }) {
  const color = active ? colors.streak : colors.textMuted;
  const size = 30;

  return (
    <View style={styles.row}>
      {active ? (
        <LottieView source={streakAnimation} autoPlay loop style={{ width: size, height: size }} />
      ) : (
        <MaterialCommunityIcons name="fire" size={26} color={color} />
      )}
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
