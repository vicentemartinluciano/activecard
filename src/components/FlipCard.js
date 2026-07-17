// Tarjeta de estudio: una sola cara con layout natural. El "giro" es un
// aplastado horizontal (scaleX) — robusto en Android new-arch, donde el
// enfoque de dos caras absolutas con rotateY/opacity se rompía.

import { Feather, FontAwesome } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import RichText from "./RichText";
import { colors, gradients, radius, spacing, textColors, type } from "../theme";

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
  const [expanded, setExpanded] = useState(false); // modal "Ver completo"
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
          {/* ScrollView: el dorso (o el frente) largo se puede leer scrolleando
              en vertical. El swipe horizontal lo sigue tomando el PanResponder
              del SwipeCard (exige dx>dy). El tap para girar va en un Pressable
              PROPIO adentro del scroll: un ScrollView se queda con el toque y no
              deja que suba al Pressable de afuera, así que sin esto tocar el
              texto no giraba la tarjeta. contentContainerStyle centra el texto
              corto y deja crecer el largo. */}
          <ScrollView
            ref={scrollRef}
            style={styles.textBox}
            contentContainerStyle={styles.textContent}
            showsVerticalScrollIndicator
          >
            <Pressable onPress={onFlip}>
              <RichText text={faceText} style={styles.text} />
            </Pressable>
          </ScrollView>
          <Pressable onPress={() => setExpanded(true)} hitSlop={8} style={styles.expandBtn}>
            <Feather name="maximize-2" size={13} color={colors.textMuted} />
            <Text style={styles.hint}>Ver completo</Text>
          </Pressable>
        </LinearGradient>
      </Animated.View>

      {/* "Ver completo": la cara actual a pantalla casi completa, scrolleable. */}
      <Modal
        transparent
        visible={expanded}
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setExpanded(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.hint}>{showBack ? "Respuesta" : "Pregunta"}</Text>
              <Pressable onPress={() => setExpanded(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator
            >
              <RichText text={faceText} style={styles.modalText} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
    alignSelf: "stretch",
  },
  textContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  text: {
    ...type.body,
    fontSize: 20,
    lineHeight: 30,
    // Sin textAlign: la alineación la decide cada bloque (RichText la aplica
    // según cómo se creó la tarjeta). Default = izquierda.
  },
  expandBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 16,
  },
  hint: {
    ...type.small,
    minHeight: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#000000B3",
    justifyContent: "center",
    padding: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    width: "100%",
    maxWidth: 480,
    maxHeight: "85%",
    alignSelf: "center",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  modalScroll: {
    alignSelf: "stretch",
    // flexShrink: sin esto el ScrollView crece con su contenido y empuja la
    // card más allá del maxHeight en vez de scrollear. Con flexShrink queda
    // acotado por el maxHeight de la card y arrastra cuando el texto no entra.
    flexShrink: 1,
  },
  modalContent: {
    paddingBottom: spacing.sm,
  },
  modalText: {
    ...type.body,
    fontSize: 19,
    lineHeight: 29,
  },
});
