// Tarjeta con giro 3D sobrio: frente (pregunta) → tap → dorso (respuesta).
// Usa Animated de RN core (funciona igual en Android y web).

import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import RichText from "./RichText";
import { colors, radius, spacing, type } from "../theme";

export default function FlipCard({ front, back, flipped, onFlip }) {
  const anim = useRef(new Animated.Value(flipped ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: flipped ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [flipped, anim]);

  const frontRotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const backRotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["180deg", "360deg"],
  });
  const frontOpacity = anim.interpolate({
    inputRange: [0, 0.5, 0.5001, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = anim.interpolate({
    inputRange: [0, 0.4999, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  return (
    <Pressable onPress={onFlip} style={styles.wrapper}>
      <Animated.View
        pointerEvents={flipped ? "none" : "auto"}
        style={[
          styles.face,
          !flipped && styles.faceOnTop,
          {
            opacity: frontOpacity,
            transform: [{ perspective: 1000 }, { rotateY: frontRotate }],
          },
        ]}
      >
        <Text style={styles.hint}>Pregunta</Text>
        <View style={styles.textBox}>
          <RichText text={front} style={styles.text} />
        </View>
        <Text style={styles.hint}>tocá para dar vuelta</Text>
      </Animated.View>
      <Animated.View
        pointerEvents={flipped ? "auto" : "none"}
        style={[
          styles.face,
          styles.faceBack,
          flipped && styles.faceOnTop,
          {
            opacity: backOpacity,
            transform: [{ perspective: 1000 }, { rotateY: backRotate }],
          },
        ]}
      >
        <Text style={styles.hint}>Respuesta</Text>
        <View style={styles.textBox}>
          <RichText text={back} style={styles.text} />
        </View>
        <Text style={styles.hint} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    minHeight: 340,
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    justifyContent: "space-between",
    alignItems: "center",
    backfaceVisibility: "hidden",
    zIndex: 1,
  },
  faceOnTop: {
    zIndex: 2,
  },
  faceBack: {
    borderColor: colors.accent,
  },
  textBox: {
    flex: 1,
    justifyContent: "center",
  },
  text: {
    ...type.body,
    fontSize: 20,
    lineHeight: 30,
    textAlign: "center",
  },
  hint: {
    ...type.small,
    minHeight: 16,
  },
});
