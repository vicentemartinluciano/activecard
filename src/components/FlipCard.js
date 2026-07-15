// Tarjeta de estudio: una sola cara con layout natural. El "giro" es un
// aplastado horizontal (scaleX) — robusto en Android new-arch, donde el
// enfoque de dos caras absolutas con rotateY/opacity se rompía.

import { Feather, FontAwesome } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import RichText from "./RichText";
import { colors, gradients, radius, spacing, textColors, type } from "../theme";

// gymArmed/onToggleGym: rayo ⚡ opcional (repaso diario) — al armarlo, DESPUÉS
// de calificar esta tarjeta se abre el Gimnasio Mental. Decisión del momento:
// no persiste, cada tarjeta arranca apagada.
export default function FlipCard({
  front,
  back,
  flipped,
  onFlip,
  starred,
  onToggleStar,
  gymArmed,
  onToggleGym,
}) {
  const scaleX = useRef(new Animated.Value(1)).current;
  const [showBack, setShowBack] = useState(flipped);

  useEffect(() => {
    if (showBack === flipped) return;
    Animated.timing(scaleX, { toValue: 0, duration: 110, useNativeDriver: true }).start(() => {
      setShowBack(flipped);
      Animated.timing(scaleX, { toValue: 1, duration: 110, useNativeDriver: true }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped]);

  return (
    <Pressable onPress={onFlip} style={styles.wrapper}>
      <Animated.View style={[styles.card, { transform: [{ scaleX }] }]}>
        <LinearGradient
          colors={gradients.card}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.face}
        >
          {onToggleStar ? (
            <Pressable onPress={onToggleStar} hitSlop={10} style={styles.star}>
              {starred ? (
                <FontAwesome name="star" size={20} color="#FFC53D" />
              ) : (
                <Feather name="star" size={20} color={colors.textMuted} style={{ opacity: 0.35 }} />
              )}
            </Pressable>
          ) : null}
          {onToggleGym ? (
            <Pressable onPress={onToggleGym} hitSlop={10} style={styles.gym}>
              <Feather
                name="zap"
                size={20}
                color={gymArmed ? textColors.violeta : colors.textMuted}
                style={gymArmed ? null : { opacity: 0.35 }}
              />
            </Pressable>
          ) : null}
          <Text style={styles.hint}>{showBack ? "Respuesta" : "Pregunta"}</Text>
          <View style={styles.textBox}>
            <RichText text={showBack ? back : front} style={styles.text} />
          </View>
          <Text style={styles.hint}>{showBack ? " " : "tocá para dar vuelta"}</Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    minHeight: 340,
  },
  card: {
    flex: 1,
  },
  face: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    justifyContent: "space-between",
    alignItems: "center",
    overflow: "hidden",
  },
  star: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    zIndex: 2,
  },
  gym: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md + 36,
    zIndex: 2,
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
