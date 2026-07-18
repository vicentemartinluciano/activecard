// Tarjeta de estudio: una sola cara con layout natural. El "giro" es un
// aplastado horizontal (scaleX) — robusto en Android new-arch, donde el
// enfoque de dos caras absolutas con rotateY/opacity se rompía.

import { Feather, FontAwesome } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";

import RichText from "./RichText";
import { colors, radius, spacing, textColors, type } from "../theme";

// gymArmed/onToggleGym: rayo ⚡ opcional (repaso diario) — al armarlo, DESPUÉS
// de calificar esta tarjeta se abre el Gimnasio Mental. Decisión del momento:
// no persiste, cada tarjeta arranca apagada.
export default function FlipCard({
  cardId,
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
  const scrollRef = useRef(null);
  const prevCardId = useRef(cardId);

  // Un solo efecto para evitar carreras entre "cambió la tarjeta" y "giro".
  // - Nueva tarjeta (sin `key`, este componente ya NO se remonta): resetear al
  //   frente AL INSTANTE, sin animar, y volver el scroll arriba.
  // - Misma tarjeta: animar el giro (colapsar/expandir scaleX). showBack en las
  //   deps es clave: si tocás de nuevo durante la animación, el efecto vuelve a
  //   disparar hasta converger y la tarjeta nunca queda "sorda".
  useEffect(() => {
    if (prevCardId.current !== cardId) {
      prevCardId.current = cardId;
      scaleX.setValue(1);
      setShowBack(flipped);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    if (showBack === flipped) return;
    Animated.timing(scaleX, { toValue: 0, duration: 110, useNativeDriver: true }).start(
      ({ finished }) => {
        if (!finished) return;
        setShowBack(flipped);
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        Animated.timing(scaleX, { toValue: 1, duration: 110, useNativeDriver: true }).start();
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, flipped, showBack]);

  const faceText = showBack ? back : front;

  return (
    <Pressable onPress={onFlip} style={styles.wrapper}>
      <Animated.View style={[styles.card, { transform: [{ scaleX }] }]}>
        <View style={styles.face}>
          {/* ScrollView: el dorso (o el frente) largo se lee scrolleando en
              vertical. El swipe horizontal lo sigue tomando el PanResponder del
              SwipeCard (exige dx>dy). El tap para girar va en un Pressable PROPIO
              adentro del scroll: un ScrollView se queda con el toque y no deja
              que suba al Pressable de afuera. contentContainerStyle centra el
              texto corto y deja crecer el largo; el paddingTop deja libre la
              esquina de la estrella/rayo. El dorso arranca centrado por defecto;
              el frente, izquierda (defaultAlign). */}
          <ScrollView
            ref={scrollRef}
            style={styles.textBox}
            contentContainerStyle={styles.textContent}
            showsVerticalScrollIndicator
          >
            <Pressable onPress={onFlip}>
              <RichText
                text={faceText}
                style={styles.text}
                defaultAlign={showBack ? "center" : "left"}
              />
            </Pressable>
          </ScrollView>
          {/* Estrella y rayo AL FINAL del JSX: así se dibujan por ENCIMA del
              texto (en Android el orden de render gana; sin esto el ScrollView
              los tapaba). Absolutos en la esquina superior derecha. */}
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
        </View>
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
    // Fondo sólido oscuro (más oscuro que el degradé anterior, como el panel de
    // lectura). Sin header de "Pregunta/Respuesta": la tarjeta queda limpia.
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    justifyContent: "center",
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
    alignSelf: "stretch",
  },
  textContent: {
    flexGrow: 1,
    justifyContent: "center",
    // Deja libre la franja superior derecha donde van la estrella y el rayo,
    // así el texto (largo o pegado arriba) no arranca debajo de ellos.
    paddingTop: spacing.lg,
  },
  text: {
    ...type.body,
    fontSize: 20,
    lineHeight: 30,
    // Sin textAlign fijo: la alineación la decide cada bloque (RichText la
    // aplica según cómo se creó), con el default por cara (dorso = centro).
  },
});
