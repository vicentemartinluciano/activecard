// Confeti one-shot al terminar una sesión, hecho en código (Animated de RN
// core): lottie-react-native se congelaba en el APK new-arch, y este archivo
// único funciona igual en nativo y web.

import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, useWindowDimensions, View } from "react-native";

const COLORS = ["#4D7CFF", "#5BE7AD", "#FFC53D", "#00F2FE", "#E5484D", "#9E6EDE"];
const PIECES = 22;

function Piece({ index, screenHeight, onDone }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 2200 + (index % 6) * 200,
      delay: index * 90,
      useNativeDriver: true,
    }).start(({ finished }) => finished && onDone());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, screenHeight + 40],
  });
  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", `${360 + (index % 5) * 90}deg`],
  });

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        // left aleatorio-determinista: 37 es coprimo con 100 → reparte parejo.
        left: `${(index * 37) % 100}%`,
        width: 6,
        height: 10,
        borderRadius: 2,
        backgroundColor: COLORS[index % COLORS.length],
        transform: [{ translateY }, { rotate }],
      }}
    />
  );
}

export default function ConfettiOverlay() {
  const { height } = useWindowDimensions();
  const [done, setDone] = useState(false);
  const finishedCount = useRef(0);

  if (done) return null;

  const onPieceDone = () => {
    finishedCount.current += 1;
    if (finishedCount.current >= PIECES) setDone(true);
  };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: PIECES }, (_, i) => (
        <Piece key={i} index={i} screenHeight={height} onDone={onPieceDone} />
      ))}
    </View>
  );
}
