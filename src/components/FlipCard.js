// Tarjeta con giro 3D sobrio: frente (pregunta) → tap → dorso (respuesta).
// Usa Animated de RN core (funciona igual en Android y web).

import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";

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

  return (
    <Pressable onPress={onFlip} style={styles.wrapper}>
      <Animated.View
        style={[styles.face, { transform: [{ perspective: 1000 }, { rotateY: frontRotate }] }]}
      >
        <Text style={styles.hint}>Pregunta</Text>
        <RichText text={front} style={styles.text} />
        <Text style={styles.hint}>tocá para dar vuelta</Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.face,
          styles.faceBack,
          { transform: [{ perspective: 1000 }, { rotateY: backRotate }] },
        ]}
      >
        <Text style={styles.hint}>Respuesta</Text>
        <RichText text={back} style={styles.text} />
        <Text style={styles.hint} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    minHeight: 260,
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
  },
  faceBack: {
    borderColor: colors.accent,
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
