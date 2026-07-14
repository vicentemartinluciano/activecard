// Confeti one-shot sobre toda la pantalla al terminar una sesión.
import LottieView from "lottie-react-native";
import { useState } from "react";
import { StyleSheet } from "react-native";

const confetti = require("../../assets/lottie/confetti.json");

export default function ConfettiOverlay() {
  const [done, setDone] = useState(false);
  if (done) return null;
  return (
    <LottieView
      source={confetti}
      autoPlay
      loop={false}
      onAnimationFinish={() => setDone(true)}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    />
  );
}
