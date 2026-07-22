// Deslizamiento horizontal entre las secciones de tabs (Inicio ⇄ Crear ⇄
// Biblioteca). Gesto por react-native-gesture-handler (ya presente): al soltar
// con desplazamiento+velocidad suficientes, salta a la sección vecina. Se
// activa SOLO en horizontal (activeOffsetX) y falla si arranca vertical
// (failOffsetY), así no roba el scroll de las listas.

import { useRouter } from "expo-router";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

const ORDER = ["/", "/crear", "/biblioteca"]; // Inicio, Crear, Biblioteca

export default function SectionSwipe({ index, children }) {
  const router = useRouter();
  const go = (dir) => {
    const target = ORDER[index + dir];
    if (target) router.navigate(target);
  };
  const pan = Gesture.Pan()
    .activeOffsetX([-25, 25])
    .failOffsetY([-18, 18])
    .onEnd((e) => {
      "worklet";
      if (e.translationX <= -60 && e.velocityX < 0) runOnJS(go)(1);
      else if (e.translationX >= 60 && e.velocityX > 0) runOnJS(go)(-1);
    });
  return (
    <GestureDetector gesture={pan}>
      <View style={{ flex: 1 }}>{children}</View>
    </GestureDetector>
  );
}
