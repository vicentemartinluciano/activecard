// Deslizamiento horizontal entre Inicio, Biblioteca, Notas, Gimnasio y Progreso.
// Se activa solo ante arrastre horizontal dominante para no competir con scroll ni carruseles.

import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { Platform, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

const ORDER = ["/", "/biblioteca", "/notas", "/gimnasio", "/progreso"];

export default function SectionSwipe({ index, children }) {
  const router = useRouter();
  const go = useCallback(
    (dir) => {
      const target = ORDER[index + dir];
      if (target) router.navigate(target);
    },
    [index, router]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-32, 32])
        .failOffsetY([-14, 14])
        .onEnd((e) => {
          "worklet";
          if (Math.abs(e.translationX) <= Math.abs(e.translationY) * 1.35) return;
          if ((e.translationX <= -65 && e.velocityX <= -150) || e.translationX <= -110) {
            runOnJS(go)(1);
          } else if ((e.translationX >= 65 && e.velocityX >= 150) || e.translationX >= 110) {
            runOnJS(go)(-1);
          }
        }),
    [go]
  );

  if (Platform.OS === "web") return <View style={{ flex: 1 }}>{children}</View>;
  return (
    <GestureDetector gesture={pan}>
      <View style={{ flex: 1 }}>{children}</View>
    </GestureDetector>
  );
}
